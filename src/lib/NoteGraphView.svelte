<script>
  import { onDestroy } from 'svelte';
  import {
    db,
    graphViewHeight,
    graphViewOpen,
    graphViewZoom,
    openNoteByName,
    selectNoteByGuid,
    selectedNote,
  } from './store';
  import { buildNoteGraph } from '../utils/wikiLinks';
  import { createForceSimulation } from '../utils/forceGraph';
  import ResizeHandle from './ResizeHandle.svelte';
  import IconXcircle from './IconXcircle.svelte';
  import IconZoomFit from './IconZoomFit.svelte';

  const GRAPH_MIN_PX = 140;
  const CALENDAR_MIN_PX = 120;
  const ZOOM_MIN = 0.35;
  const ZOOM_MAX = 8;
  const ZOOM_FIT = 1;
  /** Titles stay off until clearly zoomed in past the overview. */
  const LABEL_ZOOM = 1.55;
  const SELECTED_LABEL_ZOOM = 1.15;
  const DRAG_THRESHOLD_PX = 4;
  const LABEL_MAX_CHARS = 20;

  let rootEl = $state(/** @type {HTMLElement | null} */ (null));
  let viewportEl = $state(/** @type {HTMLElement | null} */ (null));
  let width = $state(300);
  let height = $state(160);
  /** @type {ReturnType<typeof createForceSimulation> | null} */
  let sim = null;
  /** @type {Map<string, { id: string, name: string, guid: string | null, ghost: boolean, degree: number }>} */
  let metaById = new Map();
  let frame = $state(0);

  /** Graph-space pan (not screen px). */
  let panX = $state(0);
  let panY = $state(0);
  let contentCx = $state(320);
  let contentCy = $state(320);
  let contentSpan = $state(640);

  let panning = $state(false);
  let panStartX = 0;
  let panStartY = 0;
  let panOriginX = 0;
  let panOriginY = 0;
  let didPan = false;

  let dragNode = $state(
    /** @type {{ id: string, x: number, y: number, fx?: number | null, fy?: number | null } | null} */ (
      null
    )
  );
  let dragging = $state(false);
  /** True only after pointer moves past screen-pixel threshold (not graph units). */
  let didDrag = false;
  /** Physics drag armed only after threshold — keeps clicks from pinning nodes. */
  let dragArmed = false;
  let dragPointerId = /** @type {number | null} */ (null);
  let dragStartClientX = 0;
  let dragStartClientY = 0;

  let zoom = $derived(Math.max(0.2, Number($graphViewZoom) || 1));
  let selectedGuid = $derived($selectedNote?.guid || null);
  let selectedName = $derived(($selectedNote?.name || '').trim());

  let simNodes = $derived.by(() => {
    frame;
    return sim?.nodes ?? [];
  });
  let simLinks = $derived.by(() => {
    frame;
    return sim?.links ?? [];
  });

  let nodeRadius = $derived(2.2 + zoom * 0.6);
  /** ~14 CSS px in graph units so dots stay clickable when zoomed out. */
  let hitRadius = $derived(
    Math.max(nodeRadius * 2.5, ((contentSpan / zoom) / Math.max(height, 1)) * 14)
  );
  let showAllLabels = $derived(zoom >= LABEL_ZOOM);

  let viewBox = $derived.by(() => {
    frame;
    const aspect = width / Math.max(height, 1);
    const span = Math.max(contentSpan, 120) / zoom;
    const vbH = span;
    const vbW = span * aspect;
    return `${contentCx - vbW / 2 + panX} ${contentCy - vbH / 2 + panY} ${vbW} ${vbH}`;
  });

  function getGraphMax() {
    const sidebarInner = rootEl?.closest?.('.sidebar-inner');
    if (!sidebarInner) return 600;
    return Math.max(GRAPH_MIN_PX, sidebarInner.clientHeight - CALENDAR_MIN_PX);
  }

  function close() {
    graphViewOpen.set(false);
  }

  /** Reset pan and zoom so the full graph fits the viewport. */
  function zoomToFit() {
    refreshBounds();
    panX = 0;
    panY = 0;
    graphViewZoom.set(ZOOM_FIT);
  }

  function refreshBounds() {
    const nodes = sim?.nodes;
    if (!nodes?.length) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    }
    contentCx = (minX + maxX) / 2;
    contentCy = (minY + maxY) / 2;
    contentSpan = Math.max(maxX - minX, maxY - minY, 160) * 1.25;
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   */
  function clientToGraph(clientX, clientY) {
    const rect = viewportEl?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return { x: contentCx, y: contentCy };
    }
    const aspect = width / Math.max(height, 1);
    const span = Math.max(contentSpan, 120) / zoom;
    const vbH = span;
    const vbW = span * aspect;
    const vbX = contentCx - vbW / 2 + panX;
    const vbY = contentCy - vbH / 2 + panY;
    return {
      x: vbX + ((clientX - rect.left) / rect.width) * vbW,
      y: vbY + ((clientY - rect.top) / rect.height) * vbH,
    };
  }

  /**
   * @param {string} name
   */
  function shortLabel(name) {
    const s = name || '';
    if (s.length <= LABEL_MAX_CHARS) return s;
    return `${s.slice(0, LABEL_MAX_CHARS - 1)}…`;
  }

  /**
   * @param {Array<{ guid?: string, name?: string, body?: string }>} docs
   */
  function applyGraph(docs) {
    const { nodes, links } = buildNoteGraph(
      docs.map((d) => ({
        guid: d.guid,
        name: d.name,
        body: d.body,
      }))
    );

    /** @type {Map<string, number>} */
    const degree = new Map();
    for (const link of links) {
      degree.set(link.source, (degree.get(link.source) || 0) + 1);
      degree.set(link.target, (degree.get(link.target) || 0) + 1);
    }

    metaById = new Map(
      nodes.map((n) => [n.id, { ...n, degree: degree.get(n.id) || 0 }])
    );

    /** @type {Map<string, { x: number, y: number }>} */
    const prevPos = new Map(
      (sim?.nodes || []).map((n) => [n.id, { x: n.x, y: n.y }])
    );

    sim = createForceSimulation({ nodes, links, width, height });

    for (const node of sim.nodes) {
      const prev = prevPos.get(node.id);
      if (!prev) continue;
      node.x = prev.x;
      node.y = prev.y;
      node.vx = 0;
      node.vy = 0;
    }

    panX = 0;
    panY = 0;
    refreshBounds();
    startLoop();
  }

  let rafId = 0;
  let running = false;

  function startLoop() {
    if (running) {
      sim?.reheat();
      return;
    }
    running = true;
    const loop = () => {
      if (!sim) {
        running = false;
        return;
      }
      const energy = sim.tick();
      if (frame % 3 === 0) refreshBounds();
      frame += 1;
      if (dragging || sim.alpha > 0.005 || energy > 0.01) {
        rafId = requestAnimationFrame(loop);
      } else {
        refreshBounds();
        running = false;
      }
    };
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    running = false;
  }

  let rebuildTimer = 0;
  /** @type {{ unsubscribe: () => void } | null} */
  let notesSub = null;

  $effect(() => {
    let cancelled = false;

    (async () => {
      const database = await db();
      if (cancelled) return;
      notesSub = database.notes.find().$.subscribe((docs) => {
        clearTimeout(rebuildTimer);
        rebuildTimer = window.setTimeout(() => {
          if (!cancelled) applyGraph(docs);
        }, 120);
      });
    })();

    return () => {
      cancelled = true;
      clearTimeout(rebuildTimer);
      notesSub?.unsubscribe();
      notesSub = null;
      stopLoop();
      sim = null;
    };
  });

  $effect(() => {
    const el = viewportEl;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(1, Math.floor(entry.contentRect.width));
      const h = Math.max(1, Math.floor(entry.contentRect.height));
      if (w === width && h === height) return;
      width = w;
      height = h;
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  onDestroy(() => {
    clearTimeout(rebuildTimer);
    stopLoop();
  });

  /**
   * @param {string} id
   */
  function metaFor(id) {
    return metaById.get(id);
  }

  /**
   * @param {string} id
   */
  function shouldShowLabel(id) {
    if (showAllLabels) return true;
    if (id === selectedName && zoom >= SELECTED_LABEL_ZOOM) return true;
    return false;
  }

  /**
   * @param {string} id
   */
  async function onNodeClick(id) {
    if (didPan || didDrag) return;
    const meta = metaById.get(id);
    if (!meta) return;
    if (meta.guid) {
      await selectNoteByGuid(meta.guid);
    } else {
      await openNoteByName(meta.name);
    }
  }

  /**
   * @param {PointerEvent} event
   * @param {{ id: string, x: number, y: number, fx?: number | null, fy?: number | null }} node
   */
  function onNodePointerDown(event, node) {
    if (event.button != null && event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    if (!sim) return;

    dragNode = node;
    dragging = true;
    didDrag = false;
    dragArmed = false;
    dragPointerId = event.pointerId;
    dragStartClientX = event.clientX;
    dragStartClientY = event.clientY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  /**
   * @param {PointerEvent} event
   */
  function onNodePointerMove(event) {
    if (!dragging || !dragNode || !sim) return;
    if (dragPointerId != null && event.pointerId !== dragPointerId) return;

    const screenDist = Math.hypot(
      event.clientX - dragStartClientX,
      event.clientY - dragStartClientY
    );
    if (!didDrag && screenDist > DRAG_THRESHOLD_PX) {
      didDrag = true;
      dragArmed = true;
      const pt = clientToGraph(event.clientX, event.clientY);
      sim.dragStart(dragNode, pt.x, pt.y);
      startLoop();
    }
    if (!dragArmed) return;

    const pt = clientToGraph(event.clientX, event.clientY);
    sim.drag(dragNode, pt.x, pt.y);
    frame += 1;
  }

  /**
   * @param {PointerEvent} event
   */
  function onNodePointerUp(event) {
    if (!dragging || !dragNode || !sim) return;
    if (dragPointerId != null && event.pointerId !== dragPointerId) return;

    const id = dragNode.id;
    const wasDrag = didDrag;

    if (dragArmed) {
      sim.dragEnd(dragNode);
      startLoop();
    }
    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragNode = null;
    dragging = false;
    dragArmed = false;
    dragPointerId = null;

    if (!wasDrag) {
      // Open on click (no drag). Clear didPan so a prior pan doesn't block.
      didPan = false;
      onNodeClick(id);
    } else {
      requestAnimationFrame(() => {
        didDrag = false;
      });
    }
  }

  /**
   * @param {PointerEvent} event
   */
  function onViewportPointerDown(event) {
    if (event.button != null && event.button !== 0) return;
    if (dragging) return;
    if (event.target instanceof Element && event.target.closest('.graph-node')) return;
    panning = true;
    didPan = false;
    panStartX = event.clientX;
    panStartY = event.clientY;
    panOriginX = panX;
    panOriginY = panY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  /**
   * @param {PointerEvent} event
   */
  function onViewportPointerMove(event) {
    if (dragging) return;
    if (!panning) return;
    const dx = event.clientX - panStartX;
    const dy = event.clientY - panStartY;
    if (Math.abs(dx) + Math.abs(dy) > 3) didPan = true;
    const aspect = width / Math.max(height, 1);
    const span = Math.max(contentSpan, 120) / zoom;
    const vbH = span;
    const vbW = span * aspect;
    const scaleX = vbW / Math.max(width, 1);
    const scaleY = vbH / Math.max(height, 1);
    panX = panOriginX - dx * scaleX;
    panY = panOriginY - dy * scaleY;
  }

  /**
   * @param {PointerEvent} event
   */
  function onViewportPointerUp(event) {
    if (!panning) return;
    panning = false;
    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (didPan) {
      requestAnimationFrame(() => {
        didPan = false;
      });
    }
  }

  /**
   * @param {any} end
   */
  function resolveEnd(end) {
    if (end && typeof end === 'object') return end;
    if (typeof end === 'number') return simNodes[end];
    return simNodes.find((n) => n.id === end);
  }

  /**
   * @param {number} i
   */
  function linkSource(i) {
    return resolveEnd(simLinks[i]?.source);
  }

  /**
   * @param {number} i
   */
  function linkTarget(i) {
    return resolveEnd(simLinks[i]?.target);
  }
</script>

<div
  class="note-graph-view relative flex flex-col flex-shrink-0 w-full overflow-hidden"
  style="height: {$graphViewHeight}px;"
  bind:this={rootEl}
  role="region"
  aria-label="Graph view"
>
  <ResizeHandle
    orientation="vertical"
    invert
    bind:value={$graphViewHeight}
    min={GRAPH_MIN_PX}
    getMax={getGraphMax}
    ariaLabel="Resize graph view"
  />

  <div class="graph-header flex items-center justify-between flex-shrink-0 px-3">
    <span class="graph-title select-none">Graph View</span>
    <div class="graph-header-actions flex items-center justify-end gap-3">
      <button
        type="button"
        class="graph-icon-btn flex items-center justify-center"
        aria-label="Zoom to fit"
        title="Zoom to fit"
        onclick={zoomToFit}
      >
        <IconZoomFit />
      </button>
      <button
        type="button"
        class="graph-icon-btn flex items-center justify-center"
        aria-label="Close graph view"
        title="Close"
        onclick={close}
      >
        <IconXcircle />
      </button>
    </div>
  </div>

  <div class="graph-body flex flex-1 min-h-0">
    <div
      class="graph-viewport flex-1 min-h-0 min-w-0 relative overflow-hidden"
      class:is-dragging={dragging}
      bind:this={viewportEl}
      onpointerdown={onViewportPointerDown}
      onpointermove={onViewportPointerMove}
      onpointerup={onViewportPointerUp}
      onpointercancel={onViewportPointerUp}
      role="presentation"
    >
      {#if simNodes.length === 0}
        <div class="graph-empty absolute inset-0 flex items-center justify-center select-none">
          No notes yet
        </div>
      {:else}
        <svg
          class="graph-svg absolute inset-0 w-full h-full"
          viewBox={viewBox}
          xmlns="http://www.w3.org/2000/svg"
        >
          {#each simLinks as _, i (i)}
            {@const a = linkSource(i)}
            {@const b = linkTarget(i)}
            {#if a && b}
              <line class="graph-edge" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            {/if}
          {/each}
          {#each simNodes as node (node.id)}
            {@const meta = metaFor(node.id)}
            {@const selected =
              node.id === selectedName || (!!meta?.guid && meta.guid === selectedGuid)}
            {@const ghost = !!meta?.ghost}
            <g
              class="graph-node"
              class:selected
              class:ghost
              class:dragging={dragging && dragNode?.id === node.id}
              transform={`translate(${node.x}, ${node.y})`}
              role="button"
              tabindex="0"
              aria-label={meta?.name || node.id}
              onpointerdown={(e) => onNodePointerDown(e, node)}
              onpointermove={onNodePointerMove}
              onpointerup={onNodePointerUp}
              onpointercancel={onNodePointerUp}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onNodeClick(node.id);
                }
              }}
            >
              <!-- Larger invisible hit target; nodes stay visually small. -->
              <circle class="graph-hit" r={hitRadius} />
              <circle class="graph-dot" r={nodeRadius} />
              {#if shouldShowLabel(node.id)}
                <text class="graph-label" x="0" y={-nodeRadius - 3}>
                  {shortLabel(meta?.name || node.id)}
                </text>
              {/if}
            </g>
          {/each}
        </svg>
      {/if}
    </div>

    <div class="graph-zoom-rail flex flex-col items-center flex-shrink-0">
      <label class="zoom-label select-none" for="graph-zoom-range">Zoom</label>
      <input
        id="graph-zoom-range"
        class="settings-range graph-zoom-range"
        type="range"
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        step="0.05"
        bind:value={$graphViewZoom}
        aria-orientation="vertical"
        title="Zoom"
      />
    </div>
  </div>
</div>

<style>
  .note-graph-view {
    background: var(--app-statusbar-background);
    border-top: 1px solid var(--app-statusbar-border);
    color: var(--text-color);
  }

  .graph-header {
    height: 34px;
    margin-top: 2px;
  }

  .graph-title {
    font-size: 11px;
    letter-spacing: 0.04em;
    opacity: 0.7;
  }

  .graph-icon-btn {
    background: none;
    border: none;
    color: inherit;
    opacity: 0.55;
    cursor: pointer;
    padding: 2px;
    border-radius: 999px;
  }

  .graph-icon-btn:hover {
    opacity: 0.9;
  }

  .graph-body {
    min-height: 0;
  }

  .graph-zoom-rail {
    width: 28px;
    padding: 4px 0 8px;
    gap: 6px;
  }

  .zoom-label {
    font-size: 9px;
    opacity: 0.45;
    flex-shrink: 0;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    letter-spacing: 0.04em;
  }

  .graph-zoom-range {
    flex: 1;
    width: 6px;
    min-height: 0;
    height: 100%;
    padding: 0;
    background: #2b2d30;
    border-radius: 3px;
    /* Up = zoom in (rtl + vertical-lr). Keep appearance:none so track color sticks. */
    writing-mode: vertical-lr;
    direction: rtl;
    -webkit-appearance: none;
    appearance: none;
  }

  .graph-zoom-range::-webkit-slider-runnable-track {
    width: 6px;
    height: 100%;
    background: #2b2d30;
    border-radius: 3px;
  }

  .graph-zoom-range::-moz-range-track {
    width: 6px;
    height: 100%;
    background: #2b2d30;
    border-radius: 3px;
    border: none;
  }

  .graph-zoom-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    margin: 0 -4px;
    border-radius: 50%;
    background: var(--app-accent);
    border: none;
    cursor: pointer;
  }

  .graph-zoom-range::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--app-accent);
    border: none;
    cursor: pointer;
  }

  .graph-viewport {
    cursor: grab;
    touch-action: none;
  }

  .graph-viewport:active:not(.is-dragging) {
    cursor: grabbing;
  }

  .graph-viewport.is-dragging {
    cursor: grabbing;
  }

  .graph-empty {
    font-size: 11px;
    opacity: 0.4;
  }

  .graph-edge {
    stroke: currentColor;
    stroke-opacity: 0.12;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .graph-node {
    cursor: grab;
  }

  .graph-node.dragging {
    cursor: grabbing;
  }

  .graph-hit {
    fill: transparent;
    stroke: none;
  }

  .graph-dot {
    fill: currentColor;
    opacity: 0.5;
    pointer-events: none;
  }

  .graph-node.ghost .graph-dot {
    opacity: 0.2;
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
    stroke-opacity: 0.4;
    vector-effect: non-scaling-stroke;
  }

  .graph-node.selected .graph-dot {
    fill: var(--app-accent);
    opacity: 1;
    stroke: none;
  }

  .graph-node:hover .graph-dot {
    opacity: 0.85;
  }

  .graph-node.selected:hover .graph-dot {
    opacity: 1;
  }

  .graph-node.dragging .graph-dot {
    opacity: 1;
  }

  .graph-label {
    fill: currentColor;
    font-size: 10px;
    text-anchor: middle;
    opacity: 0.75;
    pointer-events: none;
    user-select: none;
  }

  .graph-node.selected .graph-label {
    opacity: 0.95;
    fill: var(--app-accent);
  }
</style>
