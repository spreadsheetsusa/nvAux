/** Shared accent color presets (Settings, Demo hero, Kanban theme bar). */

export const DEFAULT_ACCENT_COLOR = '#ed0178';

export const ACCENT_COLOR_PRESETS = [
  '#ed0178',
  '#2252a0',
  '#0f766e',
  '#c2410c',
  '#7c3aed',
];

/** @param {unknown} raw @returns {string} */
export function normalizeAccentColor(raw) {
  if (typeof raw !== 'string') return DEFAULT_ACCENT_COLOR;
  const v = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  return DEFAULT_ACCENT_COLOR;
}
