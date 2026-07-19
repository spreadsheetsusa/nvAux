import { clamp, FRAME_EDGE_MARGIN } from './clampFrame';

export const FRAME_CORNERS = ['nw', 'ne', 'sw', 'se'];
export const FRAME_MOVE_THRESHOLD = 2;

/**
 * @param {EventTarget | null} target
 * @returns {string | null}
 */
export function cornerFromTarget(target) {
  if (!(target instanceof Element)) return null;
  const el = target.closest('.window-corner');
  return el?.dataset?.corner ?? null;
}

/** @param {string | null | undefined} corner */
export function cursorForCorner(corner) {
  return corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize';
}

/**
 * @param {HTMLElement} node
 * @returns {HTMLDivElement[]}
 */
export function createCornerHandles(node) {
  return FRAME_CORNERS.map((corner) => {
    const el = document.createElement('div');
    el.className = `window-corner window-corner-${corner}`;
    el.dataset.corner = corner;
    el.setAttribute('aria-hidden', 'true');
    node.appendChild(el);
    return el;
  });
}

/**
 * Photoshop-style corner resize with opposite-corner anchor + on-screen clamp.
 * @param {{
 *   corner: string | null,
 *   dx: number,
 *   dy: number,
 *   startLeft: number,
 *   startTop: number,
 *   startWidth: number,
 *   startHeight: number,
 *   minWidth: number,
 *   minHeight: number,
 *   edge?: number,
 * }} opts
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
export function computeCornerResize(opts) {
  const edge = opts.edge ?? FRAME_EDGE_MARGIN;
  const { corner, dx, dy, startLeft, startTop, startWidth, startHeight, minWidth, minHeight } =
    opts;

  let nextLeft = startLeft;
  let nextTop = startTop;
  let nextW = startWidth;
  let nextH = startHeight;

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

  const maxW = Math.max(minWidth, window.innerWidth - edge);
  const maxH = Math.max(minHeight, window.innerHeight - edge);
  nextW = Math.round(clamp(nextW, minWidth, maxW));
  nextH = Math.round(clamp(nextH, minHeight, maxH));

  if (corner === 'sw' || corner === 'nw') {
    nextLeft = startLeft + (startWidth - nextW);
  }
  if (corner === 'ne' || corner === 'nw') {
    nextTop = startTop + (startHeight - nextH);
  }

  nextLeft = clamp(nextLeft, edge - nextW, window.innerWidth - edge);
  nextTop = clamp(nextTop, edge - nextH, window.innerHeight - edge);

  return { left: nextLeft, top: nextTop, width: nextW, height: nextH };
}

/**
 * @param {{
 *   dx: number,
 *   dy: number,
 *   startLeft: number,
 *   startTop: number,
 *   width: number,
 *   height: number,
 *   edge?: number,
 * }} opts
 * @returns {{ left: number, top: number }}
 */
export function computeClampedMove(opts) {
  const edge = opts.edge ?? FRAME_EDGE_MARGIN;
  return {
    left: clamp(
      opts.startLeft + opts.dx,
      edge - opts.width,
      window.innerWidth - edge
    ),
    top: clamp(
      opts.startTop + opts.dy,
      edge - opts.height,
      window.innerHeight - edge
    ),
  };
}
