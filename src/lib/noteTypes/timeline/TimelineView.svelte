<script>
  // @ts-nocheck
  import { onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { get } from 'svelte/store';
  import { birthDate } from '$lib/store';
  import {
    parseTimelineNote,
    serializeTimelineNote,
    createLane,
    createItem,
    setMode,
    updateItem,
    shiftItem,
    MS,
    MIN_ITEM_MS,
    MIN_PX_PER_MS,
    MAX_PX_PER_MS,
  } from './timelineModel';
  import {
    buildTicks,
    msToX,
    xToMs,
    snapMs,
    zoomAt,
    formatTickLabel,
    chooseTickUnit,
  } from './timelineScale';
  import {
    ensureAlertAudio,
    playAlertBeep,
    createAlertTracker,
  } from './timelineAlert';
  import TimelineTransport from './TimelineTransport.svelte';
  import TimelineClip from './TimelineClip.svelte';

  let {
    body = '',
    onChange,
  } = $props();

  let project = $state.raw(null);
  let theme = $state.raw({});
  let parseError = $state(null);
  let lastBody = $state('');

  let playing = $state(false);
  let playheadMs = $state(0);
  let playRate = $state(10);
  let selectedId = $state(null);
  /** @type {{ id: string, title: string } | null} */
  let toast = $state(null);
  /** @type {ReturnType<typeof setTimeout> | null} */
  let toastTimer = null;

  /** @type {HTMLDivElement | undefined} */
  let scrollEl = $state();
  /** @type {HTMLDivElement | undefined} */
  let planeEl = $state();
  let viewportWidth = $state(640);

  const LANE_META_W = 112;
  const LANE_H = 52;
  const alertTracker = createAlertTracker();

  /** @type {ReturnType<typeof setTimeout> | null} */
  let persistTimer = null;
  /** @type {{ theme: any, project: any } | null} */
  let persistPending = null;

  /** @type {number | null} */
  let rafId = null;
  let playStartedAt = 0;
  let playOriginMs = 0;

  function flushPersist() {
    if (persistTimer != null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    const pending = persistPending;
    persistPending = null;
    if (!pending) return;
    const serialized = serializeTimelineNote(pending.theme, pending.project);
    lastBody = serialized;
    onChange?.(serialized);
  }

  function schedulePersist(nextTheme, nextProject) {
    persistPending = { theme: nextTheme, project: nextProject };
    if (persistTimer != null) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      flushPersist();
    }, 280);
  }

  function emitImmediate(nextTheme, nextProject) {
    if (persistTimer != null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    persistPending = null;
    const serialized = serializeTimelineNote(nextTheme, nextProject);
    lastBody = serialized;
    project = nextProject;
    theme = nextTheme;
    parseError = null;
    onChange?.(serialized);
  }

  function updateProject(mutator, persist = 'debounce') {
    if (!project) return;
    const next = mutator(project);
    if (!next || next === project) return;
    project = next;
    if (persist === 'immediate') emitImmediate(theme, next);
    else schedulePersist(theme, next);
  }

  onDestroy(() => {
    stopPlayback(false);
    flushPersist();
    if (toastTimer) clearTimeout(toastTimer);
  });

  $effect(() => {
    const nextBody = body ?? '';
    if (nextBody === lastBody && project) return;
    lastBody = nextBody;
    const result = parseTimelineNote(nextBody);
    project = result.project;
    theme = result.theme;
    parseError = result.parseError;
    playheadMs = result.project?.playheadMs ?? 0;
  });

  $effect(() => {
    if (!scrollEl) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w && Number.isFinite(w)) viewportWidth = w;
    });
    ro.observe(scrollEl);
    return () => ro.disconnect();
  });

  let mode = $derived(project?.mode ?? 'relative');
  let pxPerMs = $derived(project?.pxPerMs ?? 1);
  let viewStartMs = $derived(project?.viewStartMs ?? 0);
  let planeWidth = $derived(
    Math.max(viewportWidth - LANE_META_W, 240)
  );
  let viewSpanMs = $derived(planeWidth / Math.max(pxPerMs, 1e-12));

  let ticks = $derived(
    project ? buildTicks(viewStartMs, planeWidth, pxPerMs, mode) : []
  );

  let accentStyle = $derived(
    theme?.accent ? `--timeline-accent: ${theme.accent}` : undefined
  );

  let playheadLabel = $derived(
    formatTickLabel(
      playheadMs,
      chooseTickUnit(viewSpanMs).format,
      mode
    )
  );

  let playheadX = $derived(msToX(playheadMs, viewStartMs, pxPerMs));

  function itemsForLane(laneId) {
    return (project?.items ?? []).filter((it) => it.laneId === laneId);
  }

  function showToast(title) {
    toast = { id: String(Date.now()), title };
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast = null;
      toastTimer = null;
    }, 2800);
  }

  function stopPlayback(persistHead = true) {
    playing = false;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (persistHead && project) {
      updateProject((p) => ({ ...p, playheadMs }), 'debounce');
    }
  }

  async function startPlayback() {
    if (!project || project.mode !== 'relative') return;
    await ensureAlertAudio();
    alertTracker.reset();
    playing = true;
    playOriginMs = playheadMs;
    playStartedAt = performance.now();

    const tick = (now) => {
      if (!playing || !project) return;
      const elapsed = (now - playStartedAt) * playRate;
      let next = playOriginMs + elapsed;
      if (next >= project.durationMs) {
        playheadMs = project.durationMs;
        const hits = alertTracker.check(playheadMs, project.items);
        for (const h of hits) {
          playAlertBeep();
          showToast(h.title);
        }
        stopPlayback(true);
        return;
      }
      playheadMs = next;
      const hits = alertTracker.check(playheadMs, project.items);
      for (const h of hits) {
        playAlertBeep();
        showToast(h.title);
      }
      // Keep playhead roughly in view
      const x = msToX(playheadMs, project.viewStartMs, project.pxPerMs);
      if (x > planeWidth * 0.85) {
        const shift = playheadMs - project.viewStartMs - planeWidth * 0.35 / project.pxPerMs;
        project = { ...project, viewStartMs: project.viewStartMs + shift };
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function onPlay() {
    startPlayback();
  }

  function onStop() {
    stopPlayback(true);
  }

  function applyZoom(factor, anchorX) {
    if (!project) return;
    const ax = anchorX ?? planeWidth / 2;
    const z = zoomAt(
      project.pxPerMs,
      factor,
      project.viewStartMs,
      ax,
      MIN_PX_PER_MS,
      MAX_PX_PER_MS
    );
    updateProject((p) => ({ ...p, ...z }), 'debounce');
  }

  function fitContents() {
    if (!project) return;
    const items = project.items;
    if (!items.length) return;
    let min = items.reduce((m, it) => Math.min(m, it.startMs), items[0].startMs);
    let max = items.reduce((m, it) => Math.max(m, it.endMs), items[0].endMs);
    if (project.mode === 'relative') {
      min = 0;
      max = Math.max(max, project.durationMs);
    }
    const pad = (max - min) * 0.08 || MS.HOUR;
    min -= pad;
    max += pad;
    const span = Math.max(max - min, MS.MINUTE);
    const nextPx = Math.min(
      MAX_PX_PER_MS,
      Math.max(MIN_PX_PER_MS, planeWidth / span)
    );
    updateProject(
      (p) => ({ ...p, viewStartMs: min, pxPerMs: nextPx }),
      'debounce'
    );
  }

  function goToday() {
    if (!project || project.mode !== 'calendar') return;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    updateProject(
      (p) => ({ ...p, viewStartMs: d.getTime() - MS.HOUR }),
      'debounce'
    );
  }

  function onModeChange(nextMode) {
    if (!project || project.mode === nextMode) return;
    stopPlayback(false);
    const birth = get(birthDate);
    updateProject(
      (p) => setMode(p, nextMode, { birthDate: birth }),
      'immediate'
    );
    queueMicrotask(() => {
      playheadMs = project?.playheadMs ?? 0;
    });
  }

  function addLane() {
    updateProject(
      (p) => ({ ...p, lanes: [...p.lanes, createLane(`Lane ${p.lanes.length + 1}`)] }),
      'immediate'
    );
  }

  function renameLane(laneId, name) {
    updateProject(
      (p) => ({
        ...p,
        lanes: p.lanes.map((l) => (l.id === laneId ? { ...l, name } : l)),
      }),
      'debounce'
    );
  }

  function deleteLane(laneId) {
    if (!project || project.lanes.length <= 1) return;
    updateProject(
      (p) => ({
        ...p,
        lanes: p.lanes.filter((l) => l.id !== laneId),
        items: p.items.filter((it) => it.laneId !== laneId),
      }),
      'immediate'
    );
  }

  function addItem(laneId, atMs) {
    if (!project) return;
    const lane = laneId || project.lanes[0]?.id;
    if (!lane) return;
    const start =
      atMs != null
        ? snapMs(atMs, viewSpanMs)
        : snapMs(
            mode === 'relative'
              ? Math.max(0, playheadMs)
              : viewStartMs + viewSpanMs * 0.25,
            viewSpanMs
          );
    const end = start + Math.max(MIN_ITEM_MS, chooseTickUnit(viewSpanMs).majorMs);
    const item = createItem(lane, start, end);
    selectedId = item.id;
    updateProject(
      (p) => {
        let durationMs = p.durationMs;
        if (p.mode === 'relative') durationMs = Math.max(durationMs, end);
        return { ...p, durationMs, items: [...p.items, item] };
      },
      'immediate'
    );
  }

  function onRename(itemId, title) {
    updateProject((p) => updateItem(p, { id: itemId, title }), 'immediate');
  }

  function onToggleAlert(itemId) {
    const it = project?.items.find((i) => i.id === itemId);
    if (!it) return;
    updateProject(
      (p) => updateItem(p, { id: itemId, alert: !it.alert }),
      'immediate'
    );
  }

  function onDelete(itemId) {
    updateProject(
      (p) => ({ ...p, items: p.items.filter((i) => i.id !== itemId) }),
      'immediate'
    );
    if (selectedId === itemId) selectedId = null;
  }

  /* ---- pointer: pan / clip drag / resize ---- */

  const DRAG_THRESHOLD = 6;

  /** @type {null | {
   *   kind: 'pan' | 'move' | 'resize-start' | 'resize-end',
   *   pointerId: number,
   *   startX: number,
   *   startY: number,
   *   originViewStart: number,
   *   itemId: string | null,
   *   active: boolean,
   *   captureEl: Element | null,
   *   lastX: number,
   * }} */
  let pointerDrag = null;

  function clearPointerDrag() {
    pointerDrag = null;
  }

  /** @param {PointerEvent} e */
  function onPlanePointerDown(e) {
    if (!project) return;
    if (e.button != null && e.button !== 0) return;
    // Ignore if target is a clip (clips stopPropagation)
    selectedId = null;
    pointerDrag = {
      kind: 'pan',
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originViewStart: project.viewStartMs,
      itemId: null,
      active: false,
      captureEl: e.currentTarget,
      lastX: e.clientX,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  /**
   * @param {PointerEvent} e
   * @param {string} itemId
   * @param {'move' | 'resize-start' | 'resize-end'} kind
   */
  function onClipPointerBegin(e, itemId, kind) {
    if (!project) return;
    pointerDrag = {
      kind,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originViewStart: project.viewStartMs,
      itemId,
      active: false,
      captureEl: e.currentTarget,
      lastX: e.clientX,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  /** @param {PointerEvent} e */
  function onPointerMove(e) {
    const drag = pointerDrag;
    if (!drag || drag.pointerId !== e.pointerId || !project) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.active) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      drag.active = true;
    }

    if (drag.kind === 'pan') {
      const deltaMs = -dx / project.pxPerMs;
      let nextStart = drag.originViewStart + deltaMs;
      if (project.mode === 'relative') {
        nextStart = Math.max(
          -viewSpanMs * 0.1,
          Math.min(nextStart, project.durationMs - viewSpanMs * 0.2)
        );
      }
      project = { ...project, viewStartMs: nextStart };
      return;
    }

    if (!drag.itemId) return;
    const deltaMs = (e.clientX - drag.startX) / project.pxPerMs;
    const snappedDelta =
      snapMs(drag.originViewStart + deltaMs, viewSpanMs) -
      snapMs(drag.originViewStart, viewSpanMs);
    // Apply from original item each move — store origin on first activate
    if (drag._originItem == null) {
      drag._originItem = project.items.find((i) => i.id === drag.itemId);
      drag._originProject = project;
    }
    if (!drag._originItem) return;
    const base = {
      ...drag._originProject,
      items: drag._originProject.items.map((it) =>
        it.id === drag.itemId ? { ...drag._originItem } : it
      ),
    };
    project = shiftItem(base, drag.itemId, snappedDelta, drag.kind);

    // Vertical lane change while moving
    if (drag.kind === 'move' && planeEl) {
      const rect = planeEl.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const laneIndex = Math.floor(y / LANE_H);
      const lane = project.lanes[laneIndex];
      if (lane && lane.id !== project.items.find((i) => i.id === drag.itemId)?.laneId) {
        project = updateItem(project, { id: drag.itemId, laneId: lane.id });
      }
    }
    drag.lastX = e.clientX;
  }

  /** @param {PointerEvent} e */
  function onPointerUp(e) {
    const drag = pointerDrag;
    if (!drag || drag.pointerId !== e.pointerId) return;
    try {
      drag.captureEl?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    if (drag.active && drag.kind !== 'pan' && project) {
      // Extend relative duration if needed
      if (project.mode === 'relative') {
        const maxEnd = project.items.reduce((m, it) => Math.max(m, it.endMs), 0);
        if (maxEnd > project.durationMs) {
          project = { ...project, durationMs: maxEnd };
        }
      }
      emitImmediate(theme, project);
    } else if (drag.active && drag.kind === 'pan' && project) {
      schedulePersist(theme, project);
    } else if (
      !drag.active &&
      drag.kind === 'pan' &&
      Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD
    ) {
      // empty tap — deselect already done
    }
    clearPointerDrag();
  }

  /** @param {WheelEvent} e */
  function onWheel(e) {
    if (!project) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = planeEl?.getBoundingClientRect();
      const ax = rect ? e.clientX - rect.left : planeWidth / 2;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      applyZoom(factor, ax);
      return;
    }
    // Horizontal pan (trackpad / shift+wheel)
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
      e.preventDefault();
      const delta = (e.shiftKey ? e.deltaY : e.deltaX) / project.pxPerMs;
      updateProject(
        (p) => ({ ...p, viewStartMs: p.viewStartMs + delta }),
        'debounce'
      );
    }
  }

  /** @param {PointerEvent} e @param {string} laneId */
  function onLaneDblClick(e, laneId) {
    if (!planeEl) return;
    const rect = planeEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const at = xToMs(x, viewStartMs, pxPerMs);
    addItem(laneId, at);
  }

  function onScrubPlayhead(e) {
    if (!project || mode !== 'relative' || !planeEl) return;
    const rect = planeEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let ms = Math.max(0, Math.min(project.durationMs, xToMs(x, viewStartMs, pxPerMs)));
    ms = snapMs(ms, viewSpanMs);
    playheadMs = ms;
    if (playing) {
      playOriginMs = ms;
      playStartedAt = performance.now();
      alertTracker.reset();
    }
    updateProject((p) => ({ ...p, playheadMs: ms }), 'debounce');
  }
</script>

{#if parseError}
  <div class="tl-error px-3 py-2 text-sm">
    Timeline parse error: {parseError}. Switch to Edit to fix the source.
  </div>
{:else if project}
  <div
    class="tl-root flex flex-col flex-1 min-h-0 w-full relative"
    style={accentStyle}
  >
    <TimelineTransport
      mode={mode}
      playing={playing}
      playheadLabel={playheadLabel}
      canPlay={mode === 'relative'}
      playRate={playRate}
      onPlay={onPlay}
      onStop={onStop}
      onPlayRate={(rate) => {
        if (playing) {
          playOriginMs = playheadMs;
          playStartedAt = performance.now();
        }
        playRate = rate;
      }}
      onZoomIn={() => applyZoom(1.2)}
      onZoomOut={() => applyZoom(1 / 1.2)}
      onFit={fitContents}
      onAddLane={addLane}
      onAddItem={() => addItem()}
      onModeChange={onModeChange}
      onGoToday={goToday}
    />

    <div
      class="tl-body flex-1 min-h-0 flex flex-col overflow-hidden"
      bind:this={scrollEl}
    >
      <!-- Ruler -->
      <div class="tl-ruler flex shrink-0">
        <div class="tl-meta tl-meta-head shrink-0" style="width: {LANE_META_W}px"></div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="tl-ruler-plane relative flex-1 min-w-0 overflow-hidden"
          style="height: 28px"
          onpointerdown={onScrubPlayhead}
        >
          {#each ticks as tick (tick.ms)}
            <div
              class="tl-tick absolute top-0 bottom-0"
              class:major={tick.major}
              style="left: {tick.x}px"
            >
              {#if tick.label}
                <span class="tl-tick-label">{tick.label}</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Lanes -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="tl-lanes flex-1 min-h-0 overflow-y-auto thin-scrollbar"
        onwheel={onWheel}
      >
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="tl-lanes-inner relative"
          bind:this={planeEl}
          onpointerdown={onPlanePointerDown}
          onpointermove={onPointerMove}
          onpointerup={onPointerUp}
          onpointercancel={onPointerUp}
        >
          {#each project.lanes as lane (lane.id)}
            <div class="tl-lane flex" style="height: {LANE_H}px">
              <div
                class="tl-meta shrink-0 flex items-center gap-1 px-2"
                style="width: {LANE_META_W}px"
              >
                <input
                  class="tl-lane-name"
                  value={lane.name}
                  onchange={(e) => renameLane(lane.id, e.currentTarget.value)}
                  onpointerdown={(e) => e.stopPropagation()}
                />
                {#if project.lanes.length > 1}
                  <button
                    type="button"
                    class="tl-lane-del"
                    title="Remove lane"
                    aria-label="Remove lane"
                    onpointerdown={(e) => e.stopPropagation()}
                    onclick={() => deleteLane(lane.id)}
                  >
                    ×
                  </button>
                {/if}
              </div>
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="tl-lane-plane relative flex-1 min-w-0 overflow-hidden"
                style="width: {planeWidth}px"
                ondblclick={(e) => onLaneDblClick(e, lane.id)}
              >
                {#each ticks.filter((t) => t.major) as tick (tick.ms + '-g-' + lane.id)}
                  <div class="tl-gridline absolute top-0 bottom-0" style="left: {tick.x}px"></div>
                {/each}

                {#each itemsForLane(lane.id) as item (item.id)}
                  <TimelineClip
                    {item}
                    left={msToX(item.startMs, viewStartMs, pxPerMs)}
                    width={Math.max(8, (item.endMs - item.startMs) * pxPerMs)}
                    selected={selectedId === item.id}
                    onPointerBegin={onClipPointerBegin}
                    onSelect={(id) => (selectedId = id)}
                    onRename={onRename}
                    onToggleAlert={onToggleAlert}
                    onDelete={onDelete}
                  />
                {/each}
              </div>
            </div>
          {/each}

          {#if mode === 'relative'}
            <div
              class="tl-playhead absolute top-0 bottom-0 pointer-events-none"
              style="left: {LANE_META_W + playheadX}px"
            ></div>
          {/if}
        </div>
      </div>
    </div>

    {#if toast}
      <div class="tl-toast" transition:fade={{ duration: 160 }} role="status">
        <strong>Now</strong>
        <span>{toast.title}</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .tl-root {
    background: var(--app-notedetail-background);
    color: var(--text-color);
    --timeline-accent: var(--app-accent);
  }
  .tl-error {
    color: #b00020;
    background: color-mix(in srgb, #b00020 10%, var(--app-notedetail-background));
  }
  .tl-meta {
    background: var(--app-omni-background);
    border-right: 1px solid var(--app-statusbar-border);
    border-bottom: 1px solid var(--app-statusbar-border);
  }
  .tl-meta-head {
    border-bottom: 1px solid var(--app-statusbar-border);
  }
  .tl-ruler {
    background: var(--app-omni-background);
    border-bottom: 1px solid var(--app-statusbar-border);
  }
  .tl-ruler-plane {
    touch-action: none;
    cursor: ew-resize;
  }
  .tl-tick {
    width: 1px;
    background: color-mix(in srgb, var(--text-color) 18%, transparent);
  }
  .tl-tick.major {
    background: color-mix(in srgb, var(--text-color) 35%, transparent);
  }
  .tl-tick-label {
    position: absolute;
    top: 2px;
    left: 3px;
    font-size: 10px;
    line-height: 1;
    white-space: nowrap;
    opacity: 0.7;
    color: var(--text-color);
    pointer-events: none;
  }
  .tl-lane {
    border-bottom: 1px solid var(--app-statusbar-border);
  }
  .tl-lane-plane {
    background: var(--app-notedetail-background);
    touch-action: none;
  }
  .tl-gridline {
    width: 1px;
    background: color-mix(in srgb, var(--text-color) 8%, transparent);
    pointer-events: none;
  }
  .tl-lane-name {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--text-color);
    font-size: 12px;
    font-weight: 600;
    outline: none;
  }
  .tl-lane-del {
    border: 0;
    background: transparent;
    color: var(--text-color);
    opacity: 0.45;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 2px 4px;
  }
  .tl-lane-del:hover {
    opacity: 0.9;
  }
  .tl-playhead {
    width: 2px;
    margin-left: -1px;
    background: var(--timeline-accent);
    z-index: 5;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--timeline-accent) 30%, transparent);
  }
  .tl-playhead::before {
    content: '';
    position: absolute;
    top: 0;
    left: -4px;
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 7px solid var(--timeline-accent);
  }
  .tl-toast {
    position: absolute;
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    z-index: 20;
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--app-omni-background) 92%, var(--timeline-accent));
    border: 1px solid color-mix(in srgb, var(--timeline-accent) 45%, var(--app-statusbar-border));
    box-shadow: 0 6px 20px color-mix(in srgb, #000 18%, transparent);
    font-size: 13px;
    pointer-events: none;
  }
  .tl-toast strong {
    color: var(--timeline-accent);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  @media (max-width: 640px) {
    .tl-lane-name {
      font-size: 11px;
    }
  }
</style>
