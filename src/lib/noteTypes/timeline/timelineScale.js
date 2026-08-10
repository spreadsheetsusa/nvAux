import { MS } from './timelineModel';

/**
 * @typedef {{
 *   ms: number,
 *   x: number,
 *   label: string,
 *   major: boolean,
 * }} TimelineTick
 */

/**
 * Choose major/minor tick steps from the visible span.
 * Day-scale → minutes/hours; multi-day → hours/days; wider → days/weeks.
 * @param {number} viewSpanMs
 * @returns {{ majorMs: number, minorMs: number, format: 'time' | 'daytime' | 'day' | 'week' }}
 */
export function chooseTickUnit(viewSpanMs) {
  const span = Math.max(viewSpanMs, MS.MINUTE);
  if (span <= 90 * MS.MINUTE) {
    return { majorMs: 15 * MS.MINUTE, minorMs: 5 * MS.MINUTE, format: 'time' };
  }
  if (span <= 6 * MS.HOUR) {
    return { majorMs: MS.HOUR, minorMs: 15 * MS.MINUTE, format: 'time' };
  }
  if (span <= 36 * MS.HOUR) {
    return { majorMs: MS.HOUR, minorMs: 30 * MS.MINUTE, format: 'daytime' };
  }
  if (span <= 4 * MS.DAY) {
    return { majorMs: 6 * MS.HOUR, minorMs: MS.HOUR, format: 'daytime' };
  }
  if (span <= 16 * MS.DAY) {
    return { majorMs: MS.DAY, minorMs: 6 * MS.HOUR, format: 'day' };
  }
  if (span <= 80 * MS.DAY) {
    return { majorMs: MS.WEEK, minorMs: MS.DAY, format: 'week' };
  }
  return { majorMs: 30 * MS.DAY, minorMs: MS.WEEK, format: 'week' };
}

/**
 * @param {number} ms
 * @param {'time' | 'daytime' | 'day' | 'week'} format
 * @param {'calendar' | 'relative'} mode
 */
export function formatTickLabel(ms, format, mode) {
  if (mode === 'relative') {
    const sign = ms < 0 ? '-' : '';
    const abs = Math.abs(ms);
    const h = Math.floor(abs / MS.HOUR);
    const m = Math.floor((abs % MS.HOUR) / MS.MINUTE);
    const s = Math.floor((abs % MS.MINUTE) / MS.SECOND);
    if (format === 'time' || abs < MS.DAY) {
      if (abs < MS.HOUR) return `${sign}${m}:${String(s).padStart(2, '0')}`;
      return `${sign}${h}:${String(m).padStart(2, '0')}`;
    }
    const d = Math.floor(abs / MS.DAY);
    const rh = Math.floor((abs % MS.DAY) / MS.HOUR);
    return `${sign}${d}d ${rh}h`;
  }

  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const day = `${d.getMonth() + 1}/${d.getDate()}`;
  if (format === 'time') return time;
  if (format === 'daytime') {
    if (d.getHours() === 0 && d.getMinutes() === 0) return day;
    return time;
  }
  if (format === 'day') return day;
  return day;
}

/**
 * @param {number} viewStartMs
 * @param {number} viewWidthPx
 * @param {number} pxPerMs
 * @param {'calendar' | 'relative'} mode
 * @returns {TimelineTick[]}
 */
export function buildTicks(viewStartMs, viewWidthPx, pxPerMs, mode) {
  if (!(pxPerMs > 0) || !(viewWidthPx > 0)) return [];
  const viewSpanMs = viewWidthPx / pxPerMs;
  const { majorMs, minorMs, format } = chooseTickUnit(viewSpanMs);
  const start = Math.floor(viewStartMs / minorMs) * minorMs;
  const end = viewStartMs + viewSpanMs + minorMs;
  /** @type {TimelineTick[]} */
  const ticks = [];
  for (let t = start; t <= end; t += minorMs) {
    const major = Math.abs(t % majorMs) < 1 || Math.abs((t % majorMs) - majorMs) < 1;
    // modulo quirks with negatives
    const rem = ((t % majorMs) + majorMs) % majorMs;
    const isMajor = rem < 1 || rem > majorMs - 1;
    if (!isMajor && !major) {
      // keep minor
    }
    ticks.push({
      ms: t,
      x: (t - viewStartMs) * pxPerMs,
      label: isMajor ? formatTickLabel(t, format, mode) : '',
      major: isMajor,
    });
    if (ticks.length > 400) break;
  }
  return ticks;
}

/**
 * @param {number} ms
 * @param {number} viewStartMs
 * @param {number} pxPerMs
 */
export function msToX(ms, viewStartMs, pxPerMs) {
  return (ms - viewStartMs) * pxPerMs;
}

/**
 * @param {number} x
 * @param {number} viewStartMs
 * @param {number} pxPerMs
 */
export function xToMs(x, viewStartMs, pxPerMs) {
  return viewStartMs + x / pxPerMs;
}

/**
 * Snap to a sensible grid for the current zoom.
 * @param {number} ms
 * @param {number} viewSpanMs
 */
export function snapMs(ms, viewSpanMs) {
  const { minorMs } = chooseTickUnit(viewSpanMs);
  return Math.round(ms / minorMs) * minorMs;
}

/**
 * Zoom around an anchor time (keeps that time under the same x).
 * @param {number} pxPerMs
 * @param {number} factor
 * @param {number} viewStartMs
 * @param {number} anchorX
 * @param {number} minPx
 * @param {number} maxPx
 */
export function zoomAt(pxPerMs, factor, viewStartMs, anchorX, minPx, maxPx) {
  const anchorMs = xToMs(anchorX, viewStartMs, pxPerMs);
  const next = Math.min(maxPx, Math.max(minPx, pxPerMs * factor));
  const nextStart = anchorMs - anchorX / next;
  return { pxPerMs: next, viewStartMs: nextStart };
}
