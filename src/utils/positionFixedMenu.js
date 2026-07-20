/**
 * Viewport-safe fixed menu placement: prefer a side, flip on overflow, then clamp.
 */

/**
 * @param {number} n
 * @param {number} lo
 * @param {number} hi
 */
function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Zero-size rect at a point (e.g. click coords).
 * @param {number} x
 * @param {number} y
 * @returns {DOMRect | { left: number, top: number, right: number, bottom: number, width: number, height: number }}
 */
export function rectFromPoint(x, y) {
  return {
    left: x,
    top: y,
    right: x,
    bottom: y,
    width: 0,
    height: 0,
  };
}

/**
 * Position a fixed menu relative to an anchor rect so it stays in the viewport.
 * Default prefer: below the anchor, end-aligned (menu right edge ↔ anchor right edge).
 *
 * @param {{ left: number, top: number, right: number, bottom: number, width: number, height: number }} anchorRect
 * @param {HTMLElement} menuEl
 * @param {{ gap?: number, prefer?: 'below-end' }} [opts]
 */
export function positionFixedMenu(anchorRect, menuEl, opts = {}) {
  if (!menuEl || typeof window === 'undefined') return;

  const gap = opts.gap ?? 4;
  const menuRect = menuEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Prefer below, end-aligned (matches former absolute right: 0 under toolbar).
  let left = anchorRect.right - menuRect.width;
  if (left < 0) {
    left = anchorRect.left;
  }
  left = clamp(left, 0, Math.max(0, vw - menuRect.width));

  let top = anchorRect.bottom + gap;
  if (top + menuRect.height > vh) {
    top = anchorRect.top - menuRect.height - gap;
  }
  top = clamp(top, 0, Math.max(0, vh - menuRect.height));

  menuEl.style.left = `${left}px`;
  menuEl.style.top = `${top}px`;
}
