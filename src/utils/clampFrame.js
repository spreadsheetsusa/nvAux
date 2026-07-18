/** Keep a useful portion of a floating frame on-screen. */
export const FRAME_EDGE_MARGIN = 48;

/**
 * @param {number} n
 * @param {number} lo
 * @param {number} hi
 */
export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Clamp a rect so size fits the viewport and a slice stays visible.
 * @param {{ left: number, top: number, width: number, height: number }} rect
 * @param {{ minWidth?: number, minHeight?: number, edge?: number }} [opts]
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
export function clampFrameRect(rect, opts = {}) {
  const edge = opts.edge ?? FRAME_EDGE_MARGIN;
  const minWidth = opts.minWidth ?? 1;
  const minHeight = opts.minHeight ?? 1;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;

  const maxW = Math.max(minWidth, vw - edge);
  const maxH = Math.max(minHeight, vh - edge);
  const width = Math.round(clamp(rect.width, minWidth, maxW));
  const height = Math.round(clamp(rect.height, minHeight, maxH));
  const left = Math.round(clamp(rect.left, edge - width, vw - edge));
  const top = Math.round(clamp(rect.top, edge - height, vh - edge));

  return { left, top, width, height };
}

/**
 * Clamp position only (fixed-size stickies).
 * @param {{ left: number, top: number }} pos
 * @param {{ width: number, height: number }} size
 * @param {{ edge?: number }} [opts]
 * @returns {{ left: number, top: number }}
 */
export function clampFramePosition(pos, size, opts = {}) {
  const clamped = clampFrameRect(
    { left: pos.left, top: pos.top, width: size.width, height: size.height },
    { ...opts, minWidth: size.width, minHeight: size.height }
  );
  return { left: clamped.left, top: clamped.top };
}
