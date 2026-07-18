/**
 * Derive an animated page-gradient palette seeded by the user's accent color.
 * No external color lib — keeps the single-file build lean.
 */

/** @param {string} hex */
function normalizeHex(hex) {
  const v = String(hex || '').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(v) ? v : '#ed0178';
}

/** @param {string} hex */
function hexToHsl(hex) {
  const h = normalizeHex(hex);
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = 0;
  switch (max) {
    case r:
      hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      hue = ((b - r) / d + 2) / 6;
      break;
    default:
      hue = ((r - g) / d + 4) / 6;
  }
  return { h: hue * 360, s, l };
}

/** @param {number} n */
function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

/**
 * @param {number} p
 * @param {number} q
 * @param {number} t
 */
function hue2rgb(p, q, t) {
  let x = t;
  if (x < 0) x += 1;
  if (x > 1) x -= 1;
  if (x < 1 / 6) return p + (q - p) * 6 * x;
  if (x < 1 / 2) return q;
  if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
  return p;
}

/**
 * @param {{ h: number, s: number, l: number }} hsl
 */
function hslToHex({ h, s, l }) {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp01(s);
  const ll = clamp01(l);
  if (ss === 0) {
    const v = Math.round(ll * 255);
    const hex = v.toString(16).padStart(2, '0');
    return `#${hex}${hex}${hex}`;
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const hk = hh / 360;
  const r = Math.round(hue2rgb(p, q, hk + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, hk) * 255);
  const b = Math.round(hue2rgb(p, q, hk - 1 / 3) * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Shortest-arc blend of `from` toward `to` by factor `t` (0..1).
 * @param {number} from
 * @param {number} to
 * @param {number} t
 */
function hueToward(from, to, t) {
  const d = ((((to - from) % 360) + 540) % 360) - 180;
  return from + d * clamp01(t);
}

/**
 * @param {string} accentHex
 * @param {{ dark?: boolean }} [opts]
 * @returns {[string, string, string, string]}
 */
export function gradientStopsFromAccent(accentHex, { dark = false } = {}) {
  const { h, s } = hexToHsl(accentHex);
  // Soft, desaturated wash — accent still seeds hue without neon chroma.
  const baseS = dark
    ? clamp01(Math.max(0.16, s * 0.42))
    : clamp01(Math.max(0.24, Math.min(0.48, s * 0.48 + 0.05)));

  // Cool stops pull toward sky/slate instead of complement (avoids green on pinks).
  const coolH = hueToward(h, 205, 0.7);
  const slateH = hueToward(h, 220, 0.85);

  // Stops: warm neighbor → accent seed → cool sky → soft slate.
  if (dark) {
    return [
      hslToHex({ h: h - 22, s: baseS, l: 0.3 }),
      hslToHex({ h, s: clamp01(baseS + 0.04), l: 0.28 }),
      hslToHex({ h: coolH, s: clamp01(baseS * 0.62), l: 0.26 }),
      hslToHex({ h: slateH, s: clamp01(baseS * 0.36), l: 0.28 }),
    ];
  }

  return [
    hslToHex({ h: h - 22, s: clamp01(baseS * 0.88), l: 0.7 }),
    hslToHex({ h, s: clamp01(baseS + 0.02), l: 0.64 }),
    hslToHex({ h: coolH, s: clamp01(baseS * 0.48), l: 0.78 }),
    hslToHex({ h: slateH, s: clamp01(baseS * 0.3), l: 0.72 }),
  ];
}

/**
 * Write gradient CSS variables on :root from the accent color.
 * @param {string} accentHex
 * @param {{ dark?: boolean }} [opts]
 */
export function applyAccentGradient(accentHex, opts = {}) {
  if (typeof document === 'undefined') return;
  const dark =
    opts.dark ??
    (typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [a, b, c, d] = gradientStopsFromAccent(accentHex, { dark });
  const root = document.documentElement;
  root.style.setProperty('--grad-1', a);
  root.style.setProperty('--grad-2', b);
  root.style.setProperty('--grad-3', c);
  root.style.setProperty('--grad-4', d);
}
