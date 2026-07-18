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

  const GRAPH_MIN_PX = 140;
  const CALENDAR_MIN_PX = 120;
  const LABEL_ZOOM = 0.95;
  const HUB_LABEL_ZOOM = 0.65;

  let rootEl = $state(/** @type {HTMLElement | null} */ (null));
  let viewportEl = $state(/** @type {HTMLElement | null} */ (null));
  let width = $state(300);
  let height = $state(160);
  /** @type {ReturnType<typeof createForceSimulation> | null} */
  let sim = null;
  /** @type {Map<string, { id: string, name: string, guid: string | null, ghost: boolean, degree: number }>} */
  let metaById = new Map();
  let frame = $state(0);
  let panX = $state(0);
  let panY = $state(0);
  let panning = $state(false);
  let panStartX = 0;
  let panStartY = 0;
  let panOriginX = 0;
  let panOriginY = 0;
  let didPan = false;

  let zoom = $derived(Number($graphViewZoom) || 1);
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

  let nodeRadius = $derived(3.5 + zoom * 1.5);
  let showAllLabels = $derived(zoom >= LABEL_ZOOM);

  let viewBox = $derived.by(() => {
    const z = Math.max(0.2, zoom);
    const vbW = width / z;
    const vbH = height / z;
    const vbX = (width - vbW) / 2 - panX / z;
    const vbY = (height - vbH) / 2 - panY / z;
    return `${vbX} ${vbY} ${vbW} ${vbH}`;
  });

  function getGraphMax() {
    const sidebarInner = rootEl?.closest?.('.sidebar-inner');
    if (!sidebarInner) return 600;
    return Math.max(GRAPH_MIN_PX, sidebarInner.clientHeight - CALENDAR_MIN_PX);
  }

  function close() {
    graphViewOpen.set(false);
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
    const prevPos = new Map((sim?.nodes || []).map((n) => [n.id, { x: n.x, y: n.y }]));

    const w = Math.max(1, width);
    const h = Math.max(1, height);
    sim = createForceSimulation({ nodes, links, width: w, height: h });

    for (const node of sim.nodes) {
      const prev = prevPos.get(node.id);
      if (!prev) continue;
      node.x = prev.x;
      node.y = prev.y;
      node.vx = 0;
      node.vy = 0;
    }

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
      frame += 1;
      if (sim.alpha > 0 || energy > 0.02) {
        rafId = requestAnimationFrame(loop);
      } else {
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
      if (sim) {
        sim.setSize(w, h);
        sim.reheat();
        startLoop();
      }
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
    if (id === selectedName) return true;
    const meta = metaById.get(id);
    if (meta && meta.degree >= 2 && zoom >= HUB_LABEL_ZOOM) return true;
    return false;
  }

  /**
   * @param {string} id
   */
  async function onNodeClick(id) {
    if (didPan) return;
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
   */
  function onViewportPointerDown(event) {
    if (event.button != null && event.button !== 0) return;
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
    if (!panning) return;
    const dx = event.clientX - panStartX;
    const dy = event.clientY - panStartY;
    if (Math.abs(dx) + Math.abs(dy) > 3) didPan = true;
    panX = panOriginX + dx;
    panY = panOriginY + dy;
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
   * @param {number} i
   */
  function linkSource(i) {
    return simNodes[simLinks[i]?.source];
  }

  /**
   * @param {number} i
   */
  function linkTarget(i) {
    return simNodes[simLinks[i]?.target];
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
    <button
      type="button"
      class="graph-close flex items-center justify-center"
      aria-label="Close graph view"
      onclick={close}
    >
      <IconXcircle />
    </button>
  </div>

  <div class="graph-zoom flex items-center gap-2 flex-shrink-0 px-3">
    <label class="zoom-label select-none" for="graph-zoom-range">Zoom</label>
    <input
      id="graph-zoom-range"
      class="settings-range"
      type="range"
      min="0.4"
      max="2.5"
      step="0.05"
      bind:value={$graphViewZoom}
    />
  </div>

  <div
    class="graph-viewport flex-1 min-h-0 relative overflow-hidden"
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
            transform={`translate(${node.x}, ${node.y})`}
            role="button"
            tabindex="0"
            aria-label={meta?.name || node.id}
            onclick={() => onNodeClick(node.id)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNodeClick(node.id);
              }
            }}
          >
            <circle r={nodeRadius} />
            {#if shouldShowLabel(node.id)}
              <text class="graph-label" x="0" y={-nodeRadius - 4}>
                {meta?.name || node.id}
              </text>
            {/if}
          </g>
        {/each}
      </svg>
    {/if}
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

  .graph-close {
    background: none;
    border: none;
    color: inherit;
    opacity: 0.55;
    cursor: pointer;
    padding: 2px;
    border-radius: 999px;
  }

  .graph-close:hover {
    opacity: 0.9;
  }

  .graph-zoom {
    height: 28px;
    margin-bottom: 2px;
  }

  .zoom-label {
    font-size: 10px;
    opacity: 0.45;
    flex-shrink: 0;
  }

  .graph-viewport {
    cursor: grab;
    touch-action: none;
  }

  .graph-viewport:active {
    cursor: grabbing;
  }

  .graph-empty {
    font-size: 11px;
    opacity: 0.4;
  }

  .graph-edge {
    stroke: currentColor;
    stroke-opacity: 0.18;
    stroke-width: 1;
  }

  .graph-node {
    cursor: pointer;
  }

  .graph-node circle {
    fill: currentColor;
    opacity: 0.55;
  }

  .graph-node.ghost circle {
    opacity: 0.22;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.25;
    stroke-opacity: 0.45;
  }

  .graph-node.selected circle {
    fill: var(--app-accent);
    opacity: 1;
    stroke: none;
  }

  .graph-node:hover circle {
    opacity: 0.85;
  }

  .graph-node.selected:hover circle {
    opacity: 1;
  }

  .graph-label {
    fill: currentColor;
    font-size: 9px;
    text-anchor: middle;
    opacity: 0.7;
    pointer-events: none;
    user-select: none;
  }

  .graph-node.selected .graph-label {
    opacity: 0.95;
    fill: var(--app-accent);
  }
</style>
