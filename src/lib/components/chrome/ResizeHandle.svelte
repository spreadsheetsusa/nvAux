<script>
  import { onDestroy } from 'svelte';

  let {
    orientation = 'vertical',
    value = $bindable(200),
    min = 80,
    max = 600,
    ariaLabel = 'Resize',
    getMax = null,
    /** When true, pointer delta is inverted (e.g. drag up to grow a bottom panel). */
    invert = false,
    /**
     * When set with min=0: drag below this snaps to 0; expand from 0 snaps open
     * once past ~half this threshold.
     */
    collapseBelow = null,
    /** Called only for user-driven value changes (drag move / drag end). */
    onUserChange = undefined,
  } = $props();

  let dragging = $state(false);
  let startPos = $state(0);
  let startValue = $state(0);
  let activeMax = $state(600);

  let canCollapse = $derived(
    typeof collapseBelow === 'number' && collapseBelow > 0 && min === 0
  );
  let isCollapsed = $derived(canCollapse && value === 0);

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function applySnap(continuous) {
    if (!canCollapse) return continuous;

    const floor = collapseBelow;
    const expandThreshold = Math.round(floor / 2);

    if (startValue > 0) {
      return continuous < floor ? 0 : continuous;
    }

    // Expanding from collapsed: stay shut until past hysteresis, then open ≥ floor.
    if (continuous < expandThreshold) return 0;
    return Math.max(floor, continuous);
  }

  function clearDrag() {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('is-panel-resizing');
    document.body.style.cursor = '';
  }

  function onPointerDown(event) {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    dragging = true;
    startPos = orientation === 'vertical' ? event.clientY : event.clientX;
    startValue = value;
    activeMax = typeof getMax === 'function' ? getMax() : max;
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add('is-panel-resizing');
    document.body.style.cursor = orientation === 'vertical' ? 'row-resize' : 'col-resize';
  }

  function onPointerMove(event) {
    if (!dragging) return;
    event.preventDefault();
    const pos = orientation === 'vertical' ? event.clientY : event.clientX;
    const delta = (pos - startPos) * (invert ? -1 : 1);
    const continuous = Math.round(clamp(startValue + delta, min, activeMax));
    value = applySnap(continuous);
    onUserChange?.(value);
  }

  function onPointerUp(event) {
    if (!dragging) return;
    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onUserChange?.(value);
    clearDrag();
  }

  onDestroy(clearDrag);
</script>

<div
  class="resize-handle select-none flex-shrink-0"
  class:vertical={orientation === 'vertical'}
  class:horizontal={orientation === 'horizontal'}
  class:is-dragging={dragging}
  class:is-collapsed={isCollapsed}
  class:row-resize={orientation === 'vertical'}
  class:col-resize={orientation === 'horizontal'}
  role="separator"
  aria-label={ariaLabel}
  aria-orientation={orientation}
  aria-valuenow={Math.round(value)}
  aria-valuemin={min}
  aria-valuemax={activeMax}
  tabindex="-1"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  onlostpointercapture={clearDrag}
></div>

<style>
  .resize-handle {
    touch-action: none;
    z-index: 2;
  }

  .resize-handle.vertical {
    display: flex;
    align-items: center;
    width: 100%;
    height: 6px;
    margin: -2px 0;
    padding: 2px 0;
    background: transparent;
    background-clip: content-box;
  }

  .resize-handle.horizontal {
    width: 6px;
    height: 100%;
    margin: 0 -2px;
    padding: 0 2px;
    position: absolute;
    top: 0;
    right: -3px;
    background: transparent;
  }

  .resize-handle.horizontal::after {
    content: '';
    display: block;
    width: 1px;
    height: 100%;
    margin: 0 auto;
    background-color: transparent;
    transition: background-color 150ms ease;
  }

  .resize-handle.horizontal:hover::after,
  .resize-handle.horizontal.is-dragging::after {
    background-color: var(--app-accent, #ed0178);
  }

  .resize-handle.vertical::after {
    content: '';
    display: block;
    width: 100%;
    height: 1px;
    background-color: var(--app-resizer-background);
    transition: background-color 150ms ease;
  }

  .resize-handle.vertical:hover::after,
  .resize-handle.vertical.is-dragging::after,
  .resize-handle.vertical.is-collapsed::after {
    background-color: var(--app-accent, #ed0178);
  }

  .resize-handle.vertical.is-collapsed::after {
    opacity: 0.55;
  }

  .resize-handle.vertical.is-collapsed:hover::after,
  .resize-handle.vertical.is-collapsed.is-dragging::after {
    opacity: 1;
  }
</style>
