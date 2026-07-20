import { clamp, FRAME_EDGE_MARGIN } from './clampFrame';

/** Corner + edge resize handles (Photoshop-style window chrome). */
export const FRAME_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
/** @deprecated Prefer FRAME_HANDLES — corners only. */
export const FRAME_CORNERS = ['nw', 'ne', 'sw', 'se'];
export const FRAME_MOVE_THRESHOLD = 2;

/**
 * @param {EventTarget | null} target
 * @returns {string | null}
 */
export function cornerFromTarget(target) {
  return handleFromTarget(target);
}

/**
 * @param {EventTarget | null} target
 * @returns {string | null}
 */
export function handleFromTarget(target) {
  if (!(target instanceof Element)) return null;
  const el = target.closest('.window-corner, .window-edge');
  return el?.dataset?.handle ?? el?.dataset?.corner ?? null;
}

/** @param {string | null | undefined} handle */
export function cursorForCorner(handle) {
  return cursorForHandle(handle);
}

/** @param {string | null | undefined} handle */
export function cursorForHandle(handle) {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'nw':
    case 'se':
    default:
      return 'nwse-resize';
  }
}

/**
 * @param {HTMLElement} node
 * @param {{ edges?: boolean }} [opts]
 * @returns {HTMLDivElement[]}
 */
export function createFrameHandles(node, opts = {}) {
  const withEdges = opts.edges !== false;
  const handles = withEdges ? FRAME_HANDLES : FRAME_CORNERS;
  return handles.map((handle) => {
    const el = document.createElement('div');
    const isCorner = handle.length === 2;
    el.className = isCorner
      ? `window-corner window-corner-${handle}`
      : `window-edge window-edge-${handle}`;
    el.dataset.handle = handle;
    // Back-compat for callers still reading data-corner
    if (isCorner) el.dataset.corner = handle;
    el.setAttribute('aria-hidden', 'true');
    node.appendChild(el);
    return el;
  });
}

/**
 * @param {HTMLElement} node
 * @returns {HTMLDivElement[]}
 */
export function createCornerHandles(node) {
  return createFrameHandles(node, { edges: false });
}

/**
 * @param {{
 *   handle?: string | null,
 *   corner?: string | null,
 *   dx: number,
 *   dy: number,
 *   startLeft: number,
 *   startTop: number,
 *   startWidth: number,
 *   startHeight: number,
 *   minWidth: number,
 *   minHeight: number,
 *   edge?: number,
 *   bounds?: { left: number, top: number, right: number, bottom: number } | null,
 *   contain?: 'full' | 'slice',
 * }} opts
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
export function computeCornerResize(opts) {
  return computeHandleResize(opts);
}

/**
 * Photoshop-style handle resize with opposite-edge/corner anchor + bounds clamp.
 * @param {{
 *   handle?: string | null,
 *   corner?: string | null,
 *   dx: number,
 *   dy: number,
 *   startLeft: number,
 *   startTop: number,
 *   startWidth: number,
 *   startHeight: number,
 *   minWidth: number,
 *   minHeight: number,
 *   edge?: number,
 *   bounds?: { left: number, top: number, right: number, bottom: number } | null,
 *   contain?: 'full' | 'slice',
 * }} opts
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
export function computeHandleResize(opts) {
  const edge = opts.edge ?? FRAME_EDGE_MARGIN;
  const handle = opts.handle ?? opts.corner ?? null;
  const contain = opts.contain ?? 'slice';
  const { dx, dy, startLeft, startTop, startWidth, startHeight, minWidth, minHeight } =
    opts;

  const bounds = opts.bounds ?? {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  };

  let nextLeft = startLeft;
  let nextTop = startTop;
  let nextW = startWidth;
  let nextH = startHeight;

  const resizeE = handle === 'e' || handle === 'ne' || handle === 'se';
  const resizeW = handle === 'w' || handle === 'nw' || handle === 'sw';
  const resizeS = handle === 's' || handle === 'se' || handle === 'sw';
  const resizeN = handle === 'n' || handle === 'ne' || handle === 'nw';

  if (resizeE) nextW = startWidth + dx;
  if (resizeW) {
    nextW = startWidth - dx;
    nextLeft = startLeft + dx;
  }
  if (resizeS) nextH = startHeight + dy;
  if (resizeN) {
    nextH = startHeight - dy;
    nextTop = startTop + dy;
  }

  const maxW = Math.max(minWidth, bounds.right - bounds.left);
  const maxH = Math.max(minHeight, bounds.bottom - bounds.top);
  nextW = Math.round(clamp(nextW, minWidth, maxW));
  nextH = Math.round(clamp(nextH, minHeight, maxH));

  // Keep the opposite edge anchored after min/max size clamps.
  if (resizeW) nextLeft = startLeft + (startWidth - nextW);
  if (resizeN) nextTop = startTop + (startHeight - nextH);

  if (contain === 'full') {
    nextLeft = clamp(nextLeft, bounds.left, bounds.right - nextW);
    nextTop = clamp(nextTop, bounds.top, bounds.bottom - nextH);
    if (nextLeft + nextW > bounds.right) {
      nextW = Math.max(minWidth, bounds.right - nextLeft);
    }
    if (nextTop + nextH > bounds.bottom) {
      nextH = Math.max(minHeight, bounds.bottom - nextTop);
    }
  } else {
    // Match prior Windowed behavior: keep a useful slice on-screen.
    nextLeft = clamp(nextLeft, bounds.left + edge - nextW, bounds.right - edge);
    nextTop = clamp(nextTop, bounds.top + edge - nextH, bounds.bottom - edge);
  }

  return {
    left: Math.round(nextLeft),
    top: Math.round(nextTop),
    width: Math.round(nextW),
    height: Math.round(nextH),
  };
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
