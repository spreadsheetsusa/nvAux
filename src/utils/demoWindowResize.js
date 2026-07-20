import { clamp } from './clampFrame';
import {
  createFrameHandles,
  cursorForHandle,
  handleFromTarget,
} from './frameResize';

const MIN_WIDTH = 360;
const MIN_HEIGHT = 300;
/** Inset from the bounds parent edges while resizing. */
const PARENT_PAD = 8;

/**
 * Demo/marketing card resize — corners + edges, no drag.
 * Size-only (stays in flex-centered flow): growing an edge expands both
 * sides equally from the center. Clamped to the parent’s visible box.
 *
 * @param {HTMLElement} node
 * @param {{
 *   enabled?: boolean,
 *   boundsEl?: HTMLElement | null,
 *   minWidth?: number,
 *   minHeight?: number,
 * }} params
 */
export function demoWindowResize(node, params = {}) {
  let enabled = !!params.enabled;
  /** @type {HTMLElement | null} */
  let boundsEl = params.boundsEl ?? null;
  let minWidth = params.minWidth ?? MIN_WIDTH;
  let minHeight = params.minHeight ?? MIN_HEIGHT;

  /** @type {number | null} */
  let width = null;
  /** @type {number | null} */
  let height = null;
  let sized = false;

  let resizing = false;
  /** @type {string | null} */
  let resizeHandle = null;
  /** @type {number | null} */
  let pointerId = null;

  let startClientX = 0;
  let startClientY = 0;
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

  /** Max size that still fits inside the parent’s visible content box. */
  function getMaxSize() {
    const parent = boundsEl;
    if (!parent) {
      return {
        maxW: Math.max(minWidth, window.innerWidth - PARENT_PAD * 2),
        maxH: Math.max(minHeight, window.innerHeight - PARENT_PAD * 2),
      };
    }
    return {
      maxW: Math.max(minWidth, parent.clientWidth - PARENT_PAD * 2),
      maxH: Math.max(minHeight, parent.clientHeight - PARENT_PAD * 2),
    };
  }

  function applySize() {
    if (!sized || width == null || height == null) return;
    const { maxW, maxH } = getMaxSize();
    width = Math.round(clamp(width, minWidth, maxW));
    height = Math.round(clamp(height, minHeight, maxH));
    node.style.width = `${width}px`;
    node.style.height = `${height}px`;
    // Allow growing past the CSS 690px max, but never past the parent.
    node.style.maxWidth = `${maxW}px`;
  }

  function clearSizeStyles() {
    node.style.removeProperty('width');
    node.style.removeProperty('height');
    node.style.removeProperty('max-width');
    node.style.removeProperty('will-change');
    node.style.removeProperty('transition');
  }

  function resetSize() {
    sized = false;
    width = null;
    height = null;
    clearSizeStyles();
  }

  function pinFromLayout() {
    const rect = node.getBoundingClientRect();
    width = Math.round(rect.width);
    height = Math.round(rect.height);
    sized = true;
    node.style.transition = 'none';
    applySize();
    requestAnimationFrame(() => {
      if (!resizing) node.style.removeProperty('transition');
    });
  }

  function ensureSized() {
    if (!sized) pinFromLayout();
  }

  function clearInteractionChrome() {
    document.body.classList.remove('is-panel-resizing');
    document.body.style.cursor = '';
    node.style.removeProperty('will-change');
    node.style.removeProperty('transition');
  }

  function armInteraction(cursor) {
    node.style.transition = 'none';
    node.style.willChange = 'width, height';
    document.body.classList.add('is-panel-resizing');
    document.body.style.cursor = cursor;
  }

  function endInteraction(event) {
    if (pointerId != null && node.hasPointerCapture?.(pointerId)) {
      try {
        node.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
    }
    if (resizing) {
      suppressClick = true;
      clearInteractionChrome();
      applySize();
    }
    resizing = false;
    resizeHandle = null;
    pointerId = null;
    event?.preventDefault?.();
  }

  /**
   * Center-anchored size delta: pointer travel on one edge moves that edge
   * 1:1, and the opposite edge mirrors — width/height change by 2× delta.
   */
  function computeCenteredSize(handle, dx, dy) {
    const { maxW, maxH } = getMaxSize();
    let nextW = startWidth;
    let nextH = startHeight;

    const resizeE = handle === 'e' || handle === 'ne' || handle === 'se';
    const resizeW = handle === 'w' || handle === 'nw' || handle === 'sw';
    const resizeS = handle === 's' || handle === 'se' || handle === 'sw';
    const resizeN = handle === 'n' || handle === 'ne' || handle === 'nw';

    if (resizeE) nextW = startWidth + dx * 2;
    else if (resizeW) nextW = startWidth - dx * 2;

    if (resizeS) nextH = startHeight + dy * 2;
    else if (resizeN) nextH = startHeight - dy * 2;

    return {
      width: Math.round(clamp(nextW, minWidth, maxW)),
      height: Math.round(clamp(nextH, minHeight, maxH)),
    };
  }

  function onPointerDown(event) {
    if (!enabled) return;
    if (event.button != null && event.button !== 0) return;
    const handleEl =
      event.target instanceof Element
        ? event.target.closest('.window-corner, .window-edge')
        : null;
    if (!(handleEl instanceof HTMLDivElement) || !handleEls.includes(handleEl)) {
      return;
    }
    const handle = handleFromTarget(handleEl);
    if (!handle) return;

    event.preventDefault();
    event.stopPropagation();
    ensureSized();

    resizing = true;
    resizeHandle = handle;
    pointerId = event.pointerId;
    startClientX = event.clientX;
    startClientY = event.clientY;
    startWidth = width;
    startHeight = height;

    try {
      node.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    armInteraction(cursorForHandle(handle));
  }

  function onPointerMove(event) {
    if (!resizing) return;
    if (pointerId != null && event.pointerId !== pointerId) return;
    event.preventDefault();

    const next = computeCenteredSize(
      resizeHandle,
      event.clientX - startClientX,
      event.clientY - startClientY
    );
    width = next.width;
    height = next.height;
    applySize();
  }

  function onPointerUp(event) {
    if (!resizing) return;
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
    if (!resizing) return;
    resizing = false;
    resizeHandle = null;
    pointerId = null;
    clearInteractionChrome();
    applySize();
  }

  function onParentResize() {
    if (!enabled || !sized || resizing) return;
    if (width == null || height == null) return;
    const prevW = width;
    const prevH = height;
    applySize();
    if (width !== prevW || height !== prevH) {
      /* reclamped to parent */
    }
  }

  syncHandles();

  node.addEventListener('pointerdown', onPointerDown);
  node.addEventListener('pointermove', onPointerMove);
  node.addEventListener('pointerup', onPointerUp);
  node.addEventListener('pointercancel', onPointerUp);
  node.addEventListener('lostpointercapture', onLostCapture);
  node.addEventListener('click', onClickCapture, true);
  window.addEventListener('resize', onParentResize);

  return {
    update(newParams = {}) {
      const nextEnabled = !!newParams.enabled;
      boundsEl = newParams.boundsEl ?? null;
      minWidth = newParams.minWidth ?? MIN_WIDTH;
      minHeight = newParams.minHeight ?? MIN_HEIGHT;

      if (enabled && !nextEnabled) {
        endInteraction();
        clearInteractionChrome();
        resetSize();
      }

      enabled = nextEnabled;
      syncHandles();

      if (enabled && sized) onParentResize();
    },
    destroy() {
      endInteraction();
      clearInteractionChrome();
      resetSize();
      window.removeEventListener('resize', onParentResize);
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
