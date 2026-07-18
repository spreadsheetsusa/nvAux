import { clamp, FRAME_EDGE_MARGIN } from './clampFrame';

const MOVE_THRESHOLD = 2;
const EDGE_MARGIN = FRAME_EDGE_MARGIN;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;
const CORNERS = ['nw', 'ne', 'sw', 'se'];

/**
 * Multi-instance floating popup move + corner resize.
 * Move only from `.popup-titlebar` (not the whole panel).
 * Owns left/top/width/height via element.style — do not also set those
 * via a Svelte `style="…"` attribute (it would wipe geometry on update).
 *
 * @param {HTMLElement} node
 * @param {{
 *   left?: number,
 *   top?: number,
 *   width?: number,
 *   height?: number,
 *   threshold?: number,
 *   resizeEnabled?: boolean,
 *   onFrame?: (rect: { left: number, top: number, width: number, height: number }) => void,
 * }} params
 */
export function popupFrame(node, params = {}) {
  let left = params.left ?? 0;
  let top = params.top ?? 0;
  let width = params.width ?? 420;
  let height = params.height ?? 320;
  let threshold = params.threshold ?? MOVE_THRESHOLD;
  let resizeEnabled = params.resizeEnabled !== false;
  /** @type {((rect: { left: number, top: number, width: number, height: number }) => void) | undefined} */
  let onFrame = params.onFrame;

  let pendingMove = false;
  let moving = false;
  let resizing = false;
  /** @type {string | null} */
  let resizeCorner = null;
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
  const cornerEls = CORNERS.map((corner) => {
    const el = document.createElement('div');
    el.className = `window-corner window-corner-${corner}`;
    el.dataset.corner = corner;
    el.setAttribute('aria-hidden', 'true');
    node.appendChild(el);
    return el;
  });

  function syncCornerVisibility() {
    for (const el of cornerEls) {
      el.style.display = resizeEnabled ? '' : 'none';
    }
  }

  function isInteracting() {
    return pendingMove || moving || resizing;
  }

  function applyFrame() {
    node.style.position = 'fixed';
    node.style.left = `${Math.round(left)}px`;
    node.style.top = `${Math.round(top)}px`;
    node.style.width = `${Math.round(width)}px`;
    node.style.height = `${Math.round(height)}px`;
    node.style.margin = '0';
    node.style.maxWidth = 'none';
    node.style.transform = 'none';
  }

  function emitFrame() {
    onFrame?.({
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(width),
      height: Math.round(height),
    });
  }

  function clearInteractionChrome() {
    document.body.classList.remove('is-panel-resizing');
    document.body.style.cursor = '';
    node.style.removeProperty('will-change');
  }

  function armInteraction(cursor) {
    node.style.willChange = 'left, top, width, height';
    document.body.classList.add('is-panel-resizing');
    document.body.style.cursor = cursor;
  }

  /** Re-sync internal state from the live box (guards against style wipes). */
  function syncFromDom() {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      left = rect.left;
      top = rect.top;
      width = Math.round(rect.width);
      height = Math.round(rect.height);
    }
    applyFrame();
  }

  function isTitlebar(target) {
    if (!(target instanceof Element)) return false;
    if (target.closest('.window-corner')) return false;
    if (target.closest('button')) return false;
    return !!target.closest('.popup-titlebar');
  }

  function cornerFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const el = target.closest('.window-corner');
    return el?.dataset?.corner ?? null;
  }

  function cursorForCorner(corner) {
    return corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize';
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
    resizeCorner = null;
    pointerId = null;
    event?.preventDefault?.();
  }

  function onCornerPointerDown(event) {
    if (!resizeEnabled) return;
    if (event.button != null && event.button !== 0) return;
    const corner = cornerFromTarget(event.target);
    if (!corner) return;

    event.preventDefault();
    event.stopPropagation();

    syncFromDom();

    resizing = true;
    resizeCorner = corner;
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
    armInteraction(cursorForCorner(corner));
  }

  function onPointerDown(event) {
    if (cornerFromTarget(event.target)) {
      onCornerPointerDown(event);
      return;
    }
    if (event.button != null && event.button !== 0) return;
    if (!isTitlebar(event.target)) return;

    syncFromDom();

    pendingMove = true;
    moving = false;
    pointerId = event.pointerId;
    startClientX = event.clientX;
    startClientY = event.clientY;
    startLeft = left;
    startTop = top;
  }

  function applyResize(dx, dy) {
    let nextLeft = startLeft;
    let nextTop = startTop;
    let nextW = startWidth;
    let nextH = startHeight;
    const corner = resizeCorner;

    if (corner === 'se') {
      nextW = startWidth + dx;
      nextH = startHeight + dy;
    } else if (corner === 'sw') {
      nextW = startWidth - dx;
      nextH = startHeight + dy;
      nextLeft = startLeft + dx;
    } else if (corner === 'ne') {
      nextW = startWidth + dx;
      nextH = startHeight - dy;
      nextTop = startTop + dy;
    } else if (corner === 'nw') {
      nextW = startWidth - dx;
      nextH = startHeight - dy;
      nextLeft = startLeft + dx;
      nextTop = startTop + dy;
    }

    const maxW = Math.max(MIN_WIDTH, window.innerWidth - EDGE_MARGIN);
    const maxH = Math.max(MIN_HEIGHT, window.innerHeight - EDGE_MARGIN);
    nextW = Math.round(clamp(nextW, MIN_WIDTH, maxW));
    nextH = Math.round(clamp(nextH, MIN_HEIGHT, maxH));

    if (corner === 'sw' || corner === 'nw') {
      nextLeft = startLeft + (startWidth - nextW);
    }
    if (corner === 'ne' || corner === 'nw') {
      nextTop = startTop + (startHeight - nextH);
    }

    nextLeft = clamp(nextLeft, EDGE_MARGIN - nextW, window.innerWidth - EDGE_MARGIN);
    nextTop = clamp(nextTop, EDGE_MARGIN - nextH, window.innerHeight - EDGE_MARGIN);

    left = nextLeft;
    top = nextTop;
    width = nextW;
    height = nextH;
    applyFrame();
  }

  function applyMove(dx, dy) {
    const nextLeft = clamp(
      startLeft + dx,
      EDGE_MARGIN - width,
      window.innerWidth - EDGE_MARGIN
    );
    const nextTop = clamp(
      startTop + dy,
      EDGE_MARGIN - height,
      window.innerHeight - EDGE_MARGIN
    );
    left = nextLeft;
    top = nextTop;
    applyFrame();
  }

  function onPointerMove(event) {
    if (pointerId != null && event.pointerId !== pointerId) return;

    if (resizing) {
      event.preventDefault();
      applyResize(event.clientX - startClientX, event.clientY - startClientY);
      return;
    }

    if (!pendingMove && !moving) return;

    const dx = event.clientX - startClientX;
    const dy = event.clientY - startClientY;

    if (!moving) {
      if (dx * dx + dy * dy < threshold * threshold) return;
      moving = true;
      pendingMove = false;
      // Re-anchor in case a reactive style update wiped geometry after pointerdown.
      syncFromDom();
      startLeft = left;
      startTop = top;
      startClientX = event.clientX;
      startClientY = event.clientY;
      try {
        node.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      armInteraction('move');
    }

    event.preventDefault();
    applyMove(event.clientX - startClientX, event.clientY - startClientY);
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
    resizeCorner = null;
    pointerId = null;
    clearInteractionChrome();
    applyFrame();
    emitFrame();
  }

  syncCornerVisibility();
  applyFrame();

  node.addEventListener('pointerdown', onPointerDown);
  node.addEventListener('pointermove', onPointerMove);
  node.addEventListener('pointerup', onPointerUp);
  node.addEventListener('pointercancel', onPointerUp);
  node.addEventListener('lostpointercapture', onLostCapture);
  node.addEventListener('click', onClickCapture, true);

  return {
    update(newParams = {}) {
      threshold = newParams.threshold ?? MOVE_THRESHOLD;
      onFrame = newParams.onFrame;
      resizeEnabled = newParams.resizeEnabled !== false;
      syncCornerVisibility();
      // Never let store/props overwrite geometry mid-drag/resize (or during pending move).
      if (isInteracting()) return;
      if (typeof newParams.left === 'number') left = newParams.left;
      if (typeof newParams.top === 'number') top = newParams.top;
      if (typeof newParams.width === 'number') width = newParams.width;
      if (typeof newParams.height === 'number') height = newParams.height;
      applyFrame();
    },
    destroy() {
      endInteraction();
      clearInteractionChrome();
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', onPointerUp);
      node.removeEventListener('pointercancel', onPointerUp);
      node.removeEventListener('lostpointercapture', onLostCapture);
      node.removeEventListener('click', onClickCapture, true);
      for (const el of cornerEls) el.remove();
    },
  };
}
