/**
 * Lean alert helpers for relative-mode timeline playback.
 * Visual toasts are managed by the view; this module owns the beep.
 */

/** @type {AudioContext | null} */
let sharedCtx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx) sharedCtx = new AC();
  return sharedCtx;
}

/** Resume audio on a user gesture (play button). */
export async function ensureAlertAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Short non-blocking notification beep.
 * @param {{ frequency?: number, durationMs?: number, gain?: number }} [opts]
 */
export function playAlertBeep(opts = {}) {
  const ctx = getCtx();
  if (!ctx) return;
  const frequency = opts.frequency ?? 880;
  const durationMs = opts.durationMs ?? 160;
  const gainLevel = opts.gain ?? 0.08;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.value = gainLevel;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(gainLevel, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  } catch {
    /* ignore audio failures */
  }
}

/**
 * Track which alerted items have already fired for the current play pass.
 * @returns {{
 *   reset: () => void,
 *   check: (playheadMs: number, items: { id: string, startMs: number, alert?: boolean, title?: string }[]) => { id: string, title: string }[]
 * }}
 */
export function createAlertTracker() {
  /** @type {Set<string>} */
  const fired = new Set();
  let lastMs = 0;

  return {
    reset() {
      fired.clear();
      lastMs = 0;
    },
    check(playheadMs, items) {
      /** @type {{ id: string, title: string }[]} */
      const hits = [];
      // Only fire when crossing forward through start
      if (playheadMs < lastMs) {
        // scrubbed backward — allow re-fire later
        for (const id of [...fired]) {
          const it = items.find((i) => i.id === id);
          if (it && playheadMs < it.startMs) fired.delete(id);
        }
      }
      for (const it of items) {
        if (!it.alert || fired.has(it.id)) continue;
        if (lastMs < it.startMs && playheadMs >= it.startMs) {
          fired.add(it.id);
          hits.push({ id: it.id, title: it.title || 'Step' });
        }
      }
      lastMs = playheadMs;
      return hits;
    },
  };
}
