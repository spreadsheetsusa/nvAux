import { clampFrameRect, FRAME_EDGE_MARGIN } from './clampFrame';
import {
  FRAME_MOVE_THRESHOLD,
  computeClampedMove,
  computeHandleResize,
  createFrameHandles,
  cursorForHandle,
  handleFromTarget,
} from './frameResize';

const MOVE_THRESHOLD = FRAME_MOVE_THRESHOLD;
const EDGE_MARGIN = FRAME_EDGE_MARGIN;
const MIN_WIDTH = 360;
const MIN_HEIGHT = 300;

/**
 * App Windowed floating-window move + corner resize.
 * Uses fixed left/top anchoring (not flex-centered transform) so opposite
 * corners stay put like a desktop window / Photoshop.
 *
 * @param {HTMLElement} node
 * @param {{
 *   enabled?: boolean,
 *   moveEnabled?: boolean,
 *   resizeEnabled?: boolean,
 *   threshold?: number,
 *   initialRect?: { left: number, top: number, width: number, height: number } | null,
 *   onFrame?: (rect: { left: number, top: number, width: number, height: number }) => void,
 * }} params
 */
export function windowFrame(node, params = {}) {
  let enabled = !!(params.enabled ?? (params.moveEnabled || params.resizeEnabled));
  let threshold = params.threshold ?? MOVE_THRESHOLD;
  /** @type {((rect: { left: number, top: number, width: number, height: number }) => void) | undefined} */
  let onFrame = params.onFrame;
  /** @type {{ left: number, top: number, width: number, height: number } | null} */
  let initialRect = params.initialRect ?? null;

  /** @type {number | null} */
  let left = null;
  /** @type {number | null} */
  let top = null;
  /** @type {number | null} */
  let width = null;
  /** @type {number | null} */
  let height = null;
  let pinned = false;

  let pendingMove = false;
  let moving = false;
  let resizing = false;
  /** @type {string | null} */
  let resizeHandle = null;
  /** @type {number | null} */
  let pointerId = null;

  let startClientX = 0;
  let startClientY = 0;
  let startLeft = 0;
  let startTop = 0;
  let startWidth = 0;
  let startHeight = 0;
  let suppressClick = false;

  /** @type {HTMLDivElement[]} */
  const handleEls = createFrameHandles(node, { edges: true });

  function syncHandles() {
    for (const el of handleEls) {
      el.style.display = enabled ? '' : 'none';
    }
  }

  function applyFrame() {
    if (!pinned || left == null || top == null || width == null || height == null) return;
    node.style.position = 'fixed';
    node.style.left = `${Math.round(left)}px`;
    node.style.top = `${Math.round(top)}px`;
    node.style.width = `${Math.round(width)}px`;
    node.style.height = `${Math.round(height)}px`;
    node.style.maxWidth = 'none';
    node.style.margin = '0';
    node.style.transform = 'none';
  }

  function clearFrameStyles() {
    node.style.removeProperty('position');
    node.style.removeProperty('left');
    node.style.removeProperty('top');
    node.style.removeProperty('width');
    node.style.removeProperty('height');
    node.style.removeProperty('max-width');
    node.style.removeProperty('margin');
    node.style.removeProperty('transform');
    node.style.removeProperty('will-change');
    node.style.removeProperty('transition');
  }

  function resetFrame() {
    pinned = false;
    left = null;
    top = null;
    width = null;
    height = null;
    clearFrameStyles();
  }

  function emitFrame() {
    if (left == null || top == null || width == null || height == null) return;
    onFrame?.({
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(width),
      height: Math.round(height),
    });
  }

  /** Default Demo-sized floating card, centered (matches `main.windowed` CSS). */
  function computeDefaultWindowedRect() {
    const sidebarOpen = node.classList.contains('sidebar-open');
    const sidebarWidth =
      parseFloat(getComputedStyle(node).getPropertyValue('--sidebar-width')) || 443;
    const pad = 16; // shell `p-2` breathing room
    const maxW = sidebarOpen ? 690 + sidebarWidth : 690;
    const availW = Math.max(MIN_WIDTH, window.innerWidth - pad);
    const availH = Math.max(MIN_HEIGHT, window.innerHeight - pad);
    const targetW = Math.round(Math.min(maxW, availW));
    const targetH = Math.round(Math.max(MIN_HEIGHT, Math.min(availH * 0.5, availH)));
    return {
      left: Math.round((window.innerWidth - targetW) / 2),
      top: Math.round((window.innerHeight - targetH) / 2),
      width: targetW,
      height: targetH,
    };
  }

  function resolveTargetRect() {
    if (
      initialRect &&
      typeof initialRect.left === 'number' &&
      typeof initialRect.top === 'number' &&
      typeof initialRect.width === 'number' &&
      typeof initialRect.height === 'number'
    ) {
      return clampFrameRect(initialRect, {
        minWidth: MIN_WIDTH,
        minHeight: MIN_HEIGHT,
      });
    }
    return computeDefaultWindowedRect();
  }

  function setFrame(next, { transition = true } = {}) {
    left = next.left;
    top = next.top;
    width = next.width;
    height = next.height;
    pinned = true;
    if (!transition) node.style.transition = 'none';
    else node.style.removeProperty('transition');
    applyFrame();
  }

  /** Pin current on-screen box (no tween) — used mid-drag when not yet pinned. */
  function pinFromLayout() {
    const rect = node.getBoundingClientRect();
    setFrame(
      {
        left: rect.left,
        top: rect.top,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      { transition: false }
    );
    requestAnimationFrame(() => {
      if (!moving && !resizing) node.style.removeProperty('transition');
    });
  }

  /**
   * Enter App Windowed: tween from the current box (usually fullscreen)
   * down to the restored or default Demo-sized card.
   */
  function enterWindowedAnimated() {
    const from = node.getBoundingClientRect();
    const to = resolveTargetRect();

    setFrame(
      {
        left: from.left,
        top: from.top,
        width: Math.round(from.width),
        height: Math.round(from.height),
      },
      { transition: false }
    );

    // Double rAF: paint the fullscreen pin, then tween to target size.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!enabled) return;
        setFrame(to, { transition: true });
        // Persist after settle so restore matches what the user sees.
        window.setTimeout(() => {
          if (enabled) emitFrame();
        }, 220);
      });
    });
  }

  function clearInteractionChrome() {
    document.body.classList.remove('is-panel-resizing');
    document.body.style.cursor = '';
    node.style.removeProperty('will-change');
    node.style.removeProperty('transition');
  }

  function armInteraction(cursor) {
    node.style.transition = 'none';
    node.style.willChange = 'left, top, width, height';
    document.body.classList.add('is-panel-resizing');
    document.body.style.cursor = cursor;
  }

  function ensurePinned() {
    if (!pinned) pinFromLayout();
  }

  function isExcluded(target) {
    if (!(target instanceof Element)) return true;
    if (target.closest('.resize-handle')) return true;
    if (target.closest('.omnibar button')) return true;
    if (target.closest('.window-corner, .window-edge')) return true;
    return false;
  }

  function isMoveEligible(target) {
    if (!(target instanceof Element)) return false;
    if (isExcluded(target)) return false;
    if (target.closest('.life-calendar')) return true;
    if (target.closest('#omni-input')) return true;
    if (target.closest('.omnibar .input-wrapper')) return true;
    if (target.closest('.omnibar') && !target.closest('button')) return true;
    return false;
  }

  function endInteraction(event) {
    if (pointerId != null && node.hasPointerCapture?.(pointerId)) {
      try {
        node.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
    }
    if (moving || resizing) {
      suppressClick = true;
      clearInteractionChrome();
      applyFrame();
      emitFrame();
    }
    pendingMove = false;
    moving = false;
    resizing = false;
    resizeHandle = null;
    pointerId = null;
    event?.preventDefault?.();
  }

  function onHandlePointerDown(event) {
    if (!enabled) return;
    if (event.button != null && event.button !== 0) return;
    const handleEl =
      event.target instanceof Element
        ? event.target.closest('.window-corner, .window-edge')
        : null;
    // Ignore Demo action's twin handles on the same node.
    if (!(handleEl instanceof HTMLDivElement) || !handleEls.includes(handleEl)) {
      return;
    }
    const handle = handleFromTarget(handleEl);
    if (!handle) return;

    event.preventDefault();
    event.stopPropagation();
    ensurePinned();

    resizing = true;
    resizeHandle = handle;
    pointerId = event.pointerId;
    startClientX = event.clientX;
    startClientY = event.clientY;
    startLeft = left;
    startTop = top;
    startWidth = width;
    startHeight = height;

    try {
      node.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    armInteraction(cursorForHandle(handle));
  }

  function onPointerDown(event) {
    if (handleFromTarget(event.target)) {
      onHandlePointerDown(event);
      return;
    }
    if (!enabled) return;
    if (event.button != null && event.button !== 0) return;
    if (!isMoveEligible(event.target)) return;

    pendingMove = true;
    moving = false;
    pointerId = event.pointerId;
    startClientX = event.clientX;
    startClientY = event.clientY;
  }

  function applyResize(dx, dy) {
    const next = computeHandleResize({
      handle: resizeHandle,
      dx,
      dy,
      startLeft,
      startTop,
      startWidth,
      startHeight,
      minWidth: MIN_WIDTH,
      minHeight: MIN_HEIGHT,
      edge: EDGE_MARGIN,
    });
    left = next.left;
    top = next.top;
    width = next.width;
    height = next.height;
    applyFrame();
  }

  function applyMove(dx, dy) {
    const next = computeClampedMove({
      dx,
      dy,
      startLeft,
      startTop,
      width,
      height,
      edge: EDGE_MARGIN,
    });
    left = next.left;
    top = next.top;
    applyFrame();
  }

  function onPointerMove(event) {
    if (pointerId != null && event.pointerId !== pointerId) return;

    if (resizing) {
      event.preventDefault();
      applyResize(event.clientX - startClientX, event.clientY - startClientY);
      return;
    }

    if (!enabled || (!pendingMove && !moving)) return;

    const dx = event.clientX - startClientX;
    const dy = event.clientY - startClientY;

    if (!moving) {
      if (dx * dx + dy * dy < threshold * threshold) return;
      ensurePinned();
      moving = true;
      pendingMove = false;
      startLeft = left;
      startTop = top;
      try {
        node.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      armInteraction('move');
    }

    event.preventDefault();
    applyMove(dx, dy);
  }

  function onPointerUp(event) {
    if (!pendingMove && !moving && !resizing) return;
    if (pointerId != null && event.pointerId !== pointerId) return;
    endInteraction(event);
  }

  function onClickCapture(event) {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function onLostCapture() {
    if (!pendingMove && !moving && !resizing) return;
    pendingMove = false;
    moving = false;
    resizing = false;
    resizeHandle = null;
    pointerId = null;
    clearInteractionChrome();
    applyFrame();
    emitFrame();
  }

  function onViewportResize() {
    if (!enabled || !pinned || left == null || top == null || width == null || height == null) {
      return;
    }
    if (moving || resizing || pendingMove) return;
    const next = clampFrameRect(
      { left, top, width, height },
      { minWidth: MIN_WIDTH, minHeight: MIN_HEIGHT }
    );
    if (
      next.left === left &&
      next.top === top &&
      next.width === width &&
      next.height === height
    ) {
      return;
    }
    setFrame(next, { transition: false });
    emitFrame();
  }

  syncHandles();
  if (enabled) {
    // Fresh load already in Windowed: restore persisted frame or default card.
    setFrame(resolveTargetRect(), { transition: false });
    requestAnimationFrame(() => node.style.removeProperty('transition'));
    emitFrame();
  }

  node.addEventListener('pointerdown', onPointerDown);
  node.addEventListener('pointermove', onPointerMove);
  node.addEventListener('pointerup', onPointerUp);
  node.addEventListener('pointercancel', onPointerUp);
  node.addEventListener('lostpointercapture', onLostCapture);
  node.addEventListener('click', onClickCapture, true);
  window.addEventListener('resize', onViewportResize);

  return {
    update(newParams = {}) {
      const nextEnabled = !!(
        newParams.enabled ?? (newParams.moveEnabled || newParams.resizeEnabled)
      );
      threshold = newParams.threshold ?? MOVE_THRESHOLD;
      onFrame = newParams.onFrame;
      if (newParams.initialRect !== undefined) {
        initialRect = newParams.initialRect ?? null;
      }

      if (enabled && !nextEnabled) {
        endInteraction();
        clearInteractionChrome();
        resetFrame();
      } else if (!enabled && nextEnabled) {
        enabled = true;
        syncHandles();
        enterWindowedAnimated();
        return;
      }

      enabled = nextEnabled;
      syncHandles();
    },
    destroy() {
      endInteraction();
      clearInteractionChrome();
      resetFrame();
      window.removeEventListener('resize', onViewportResize);
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', onPointerUp);
      node.removeEventListener('pointercancel', onPointerUp);
      node.removeEventListener('lostpointercapture', onLostCapture);
      node.removeEventListener('click', onClickCapture, true);
      for (const el of handleEls) el.remove();
    },
  };
}
