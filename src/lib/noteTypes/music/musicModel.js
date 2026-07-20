import { v4 as uuidv4 } from 'uuid';

import { parseNoteMeta, serializeNoteMeta } from '../parseNoteMeta';
import { DEFAULT_KIT, sampleUrl } from './sampleCatalog';

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   sampleUrl: string,
 *   mute: boolean,
 *   solo: boolean,
 *   volume: number,
 *   pattern: number[],
 * }} MusicTrack
 *
 * @typedef {{
 *   filterFreq: number,
 *   filterQ: number,
 *   distortion: number,
 *   delay: number,
 *   delayTime: number,
 *   reverb: number,
 * }} MusicEffects
 *
 * @typedef {{ steps: number[][] } | null} PatternBankSlot
 *
 * @typedef {{
 *   version: number,
 *   bpm: number,
 *   swing: number,
 *   steps: number,
 *   activePattern: number,
 *   patternBank: PatternBankSlot[],
 *   effects: MusicEffects,
 *   tracks: MusicTrack[],
 * }} MusicProject
 *
 * @typedef {{ skin?: string }} MusicTheme
 */

export const DEFAULT_STEPS = 16;
export const STEP_OPTIONS = /** @type {const} */ ([16, 32, 64]);
export const PATTERN_BANK_SIZE = 9;
export const DEFAULT_BPM = 120;
export const MIN_BPM = 40;
export const MAX_BPM = 240;

/** @returns {MusicEffects} */
export function defaultEffects() {
  return {
    filterFreq: 12000,
    filterQ: 1,
    distortion: 0,
    delay: 0,
    delayTime: 0.25,
    reverb: 0,
  };
}

/** @param {string} [prefix] */
function newId(prefix = 'trk') {
  return `${prefix}_${uuidv4().slice(0, 8)}`;
}

/**
 * @param {number} steps
 * @returns {number[]}
 */
export function emptyPattern(steps = DEFAULT_STEPS) {
  return Array.from({ length: steps }, () => 0);
}

/**
 * @param {number[]} pattern
 * @param {number} steps
 * @returns {number[]}
 */
function resizePattern(pattern, steps) {
  const next = emptyPattern(steps);
  const src = Array.isArray(pattern) ? pattern : [];
  for (let i = 0; i < steps; i++) {
    next[i] = src[i] ? 1 : 0;
  }
  return next;
}

/**
 * Classic starter groove for the default 8-track kit.
 * @param {number} steps
 * @returns {number[][]}
 */
function starterPatterns(steps = DEFAULT_STEPS) {
  const p = () => emptyPattern(steps);
  const kick = p();
  const snare = p();
  const closedHat = p();
  const openHat = p();
  const clap = p();
  const perc = p();
  const tom = p();
  const crash = p();

  for (let i = 0; i < steps; i += 4) kick[i] = 1;
  snare[4] = 1;
  snare[12] = 1;
  if (steps > 16) {
    snare[20] = 1;
    snare[28] = 1;
  }
  if (steps > 32) {
    snare[36] = 1;
    snare[44] = 1;
    snare[52] = 1;
    snare[60] = 1;
  }
  for (let i = 0; i < steps; i += 2) closedHat[i] = 1;
  openHat[6] = 1;
  openHat[14] = 1;
  clap[4] = 1;
  clap[12] = 1;
  perc[3] = 1;
  perc[11] = 1;
  tom[14] = 1;
  crash[0] = 1;

  return [kick, snare, closedHat, openHat, clap, perc, tom, crash];
}

/**
 * @param {number} trackCount
 * @param {number} steps
 * @param {number[][] | null} [patterns]
 * @returns {PatternBankSlot[]}
 */
function emptyPatternBank(trackCount, steps, patterns = null) {
  /** @type {PatternBankSlot[]} */
  const bank = Array.from({ length: PATTERN_BANK_SIZE }, () => null);
  if (patterns) {
    bank[0] = {
      steps: patterns.map((p) => resizePattern(p, steps)),
    };
  }
  return bank;
}

/**
 * @param {MusicTrack[]} tracks
 * @returns {{ steps: number[][] }}
 */
function snapshotPatterns(tracks) {
  return {
    steps: tracks.map((t) => [...t.pattern]),
  };
}

/**
 * @returns {MusicProject}
 */
export function emptyMusicProject() {
  const steps = DEFAULT_STEPS;
  const patterns = starterPatterns(steps);
  const tracks = DEFAULT_KIT.map((kit, i) => ({
    id: newId('trk'),
    name: kit.name,
    sampleUrl: sampleUrl(kit.file),
    mute: false,
    solo: false,
    volume: 0.85,
    pattern: patterns[i] ? [...patterns[i]] : emptyPattern(steps),
  }));

  return {
    version: 2,
    bpm: DEFAULT_BPM,
    swing: 0,
    steps,
    activePattern: 0,
    patternBank: emptyPatternBank(tracks.length, steps, patterns),
    effects: defaultEffects(),
    tracks,
  };
}

/** @returns {string} */
export function defaultMusicBody() {
  return serializeMusicNote({ skin: 'winamp' }, emptyMusicProject());
}

/**
 * @param {string | null | undefined} body
 * @returns {{ theme: MusicTheme, project: MusicProject, parseError: string | null }}
 */
export function parseMusicNote(body) {
  const meta = parseNoteMeta(body ?? '');
  /** @type {MusicTheme} */
  const theme = {
    skin: meta.theme?.skin === 'winamp' || !meta.theme?.skin ? 'winamp' : meta.theme.skin,
  };

  const raw = (meta.bodyWithoutMeta || '').trim();
  if (!raw) {
    return { theme, project: emptyMusicProject(), parseError: null };
  }

  try {
    const parsed = JSON.parse(raw);
    return { theme, project: normalizeProject(parsed), parseError: null };
  } catch (err) {
    return {
      theme,
      project: emptyMusicProject(),
      parseError: err instanceof Error ? err.message : 'Invalid music JSON',
    };
  }
}

/**
 * @param {MusicTheme} theme
 * @param {MusicProject} project
 * @returns {string}
 */
export function serializeMusicNote(theme, project) {
  const json = JSON.stringify(project, null, 2);
  /** @type {{ type: string, theme?: MusicTheme }} */
  const meta = { type: 'music' };
  const themeOut = {};
  if (theme?.skin) themeOut.skin = theme.skin;
  if (Object.keys(themeOut).length) meta.theme = themeOut;
  return serializeNoteMeta(meta, json);
}

/**
 * @param {unknown} raw
 * @returns {number}
 */
function normalizeSteps(raw) {
  const n = typeof raw === 'number' ? Math.floor(raw) : DEFAULT_STEPS;
  if (STEP_OPTIONS.includes(/** @type {16|32|64} */ (n))) return n;
  if (n > 0 && n <= 64) {
    // Nearest allowed option
    if (n <= 16) return 16;
    if (n <= 32) return 32;
    return 64;
  }
  return DEFAULT_STEPS;
}

/**
 * @param {unknown} raw
 * @returns {MusicEffects}
 */
function normalizeEffects(raw) {
  const base = defaultEffects();
  if (!raw || typeof raw !== 'object') return base;
  const e = /** @type {Record<string, unknown>} */ (raw);

  const clamp = (v, lo, hi, fallback) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    return Math.min(hi, Math.max(lo, n));
  };

  return {
    filterFreq: clamp(e.filterFreq, 200, 12000, base.filterFreq),
    filterQ: clamp(e.filterQ, 0.1, 18, base.filterQ),
    distortion: clamp(e.distortion, 0, 1, base.distortion),
    delay: clamp(e.delay, 0, 1, base.delay),
    delayTime: clamp(e.delayTime, 0.05, 1, base.delayTime),
    reverb: clamp(e.reverb, 0, 1, base.reverb),
  };
}

/**
 * @param {unknown} raw
 * @param {number} trackCount
 * @param {number} steps
 * @param {number[][]} fallbackSlot0
 * @returns {PatternBankSlot[]}
 */
function normalizePatternBank(raw, trackCount, steps, fallbackSlot0) {
  /** @type {PatternBankSlot[]} */
  const bank = Array.from({ length: PATTERN_BANK_SIZE }, () => null);

  if (!Array.isArray(raw)) {
    bank[0] = { steps: fallbackSlot0.map((p) => resizePattern(p, steps)) };
    return bank;
  }

  for (let i = 0; i < PATTERN_BANK_SIZE; i++) {
    const slot = raw[i];
    if (!slot || typeof slot !== 'object') {
      bank[i] = null;
      continue;
    }
    const stepsIn = /** @type {{ steps?: unknown }} */ (slot).steps;
    if (!Array.isArray(stepsIn)) {
      bank[i] = null;
      continue;
    }
    /** @type {number[][]} */
    const resized = [];
    for (let t = 0; t < trackCount; t++) {
      resized.push(resizePattern(/** @type {number[]} */ (stepsIn[t] ?? []), steps));
    }
    bank[i] = { steps: resized };
  }

  if (!bank.some(Boolean) && fallbackSlot0.length) {
    bank[0] = { steps: fallbackSlot0.map((p) => resizePattern(p, steps)) };
  }

  return bank;
}

/**
 * @param {unknown} raw
 * @returns {MusicProject}
 */
function normalizeProject(raw) {
  if (!raw || typeof raw !== 'object') return emptyMusicProject();
  const obj = /** @type {Record<string, unknown>} */ (raw);

  const steps = normalizeSteps(obj.steps);

  let bpm =
    typeof obj.bpm === 'number' && Number.isFinite(obj.bpm)
      ? Math.round(obj.bpm)
      : DEFAULT_BPM;
  bpm = Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));

  let swing =
    typeof obj.swing === 'number' && Number.isFinite(obj.swing) ? obj.swing : 0;
  swing = Math.min(1, Math.max(0, swing));

  const tracksIn = Array.isArray(obj.tracks) ? obj.tracks : [];
  const baseTracks =
    tracksIn.length > 0
      ? tracksIn.map((t) => normalizeTrack(t, steps))
      : emptyMusicProject().tracks;

  const workingPatterns = baseTracks.map((t) => [...t.pattern]);
  const patternBank = normalizePatternBank(
    obj.patternBank,
    baseTracks.length,
    steps,
    workingPatterns
  );

  let activePattern =
    typeof obj.activePattern === 'number' && Number.isFinite(obj.activePattern)
      ? Math.floor(obj.activePattern)
      : 0;
  activePattern = Math.min(PATTERN_BANK_SIZE - 1, Math.max(0, activePattern));

  // Ensure working patterns match active bank slot when slot is filled
  const activeSlot = patternBank[activePattern];
  const tracks = baseTracks.map((t, i) => ({
    ...t,
    pattern: activeSlot?.steps?.[i]
      ? resizePattern(activeSlot.steps[i], steps)
      : obj.patternBank == null
        ? t.pattern
        : emptyPattern(steps),
  }));

  // v1 migration: no patternBank → slot 0 = working patterns
  if (obj.patternBank == null) {
    patternBank[0] = snapshotPatterns(tracks);
    activePattern = 0;
  }

  return {
    version: 2,
    bpm,
    swing,
    steps,
    activePattern,
    patternBank,
    effects: normalizeEffects(obj.effects),
    tracks,
  };
}

/**
 * @param {unknown} raw
 * @param {number} steps
 * @returns {MusicTrack}
 */
function normalizeTrack(raw, steps) {
  const t = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  const patternIn = Array.isArray(t.pattern) ? t.pattern : [];
  const pattern = resizePattern(/** @type {number[]} */ (patternIn), steps);

  let volume =
    typeof t.volume === 'number' && Number.isFinite(t.volume) ? t.volume : 0.85;
  volume = Math.min(1, Math.max(0, volume));

  return {
    id: typeof t.id === 'string' && t.id ? t.id : newId('trk'),
    name: typeof t.name === 'string' && t.name ? t.name : 'Track',
    sampleUrl:
      typeof t.sampleUrl === 'string' && t.sampleUrl
        ? t.sampleUrl
        : sampleUrl('kick-808.wav'),
    mute: t.mute === true,
    solo: t.solo === true,
    volume,
    pattern,
  };
}

/**
 * @param {MusicProject} project
 * @param {number} nextSteps
 * @returns {MusicProject}
 */
export function setSteps(project, nextSteps) {
  const steps = normalizeSteps(nextSteps);
  if (steps === project.steps) return project;

  const tracks = project.tracks.map((t) => ({
    ...t,
    pattern: resizePattern(t.pattern, steps),
  }));

  const patternBank = project.patternBank.map((slot) => {
    if (!slot) return null;
    return {
      steps: Array.from({ length: tracks.length }, (_, i) =>
        resizePattern(slot.steps[i] ?? [], steps)
      ),
    };
  });

  return { ...project, steps, tracks, patternBank, version: 2 };
}

/**
 * @param {MusicProject} project
 * @param {number} index
 * @returns {MusicProject}
 */
export function selectPattern(project, index) {
  const i = Math.min(PATTERN_BANK_SIZE - 1, Math.max(0, Math.floor(index)));
  if (i === project.activePattern) return project;

  // Persist working grid into the slot we're leaving (no separate Store).
  const bank = [...project.patternBank];
  bank[project.activePattern] = snapshotPatterns(project.tracks);

  const slot = bank[i];
  const tracks = project.tracks.map((t, ti) => ({
    ...t,
    pattern: slot?.steps?.[ti]
      ? resizePattern(slot.steps[ti], project.steps)
      : emptyPattern(project.steps),
  }));

  return {
    ...project,
    version: 2,
    activePattern: i,
    patternBank: bank,
    tracks,
  };
}

/**
 * Store current working patterns into a bank slot (default: active).
 * @param {MusicProject} project
 * @param {number} [index]
 * @returns {MusicProject}
 */
export function storePattern(project, index) {
  const i =
    index == null
      ? project.activePattern
      : Math.min(PATTERN_BANK_SIZE - 1, Math.max(0, Math.floor(index)));
  const bank = [...project.patternBank];
  bank[i] = snapshotPatterns(project.tracks);
  return {
    ...project,
    version: 2,
    activePattern: i,
    patternBank: bank,
  };
}

/**
 * @param {MusicProject} project
 * @param {number} index
 * @returns {MusicProject}
 */
export function clearPatternSlot(project, index) {
  const i = Math.min(PATTERN_BANK_SIZE - 1, Math.max(0, Math.floor(index)));
  const bank = [...project.patternBank];
  bank[i] = null;
  if (i === project.activePattern) {
    return {
      ...project,
      version: 2,
      patternBank: bank,
      tracks: project.tracks.map((t) => ({
        ...t,
        pattern: emptyPattern(project.steps),
      })),
    };
  }
  return { ...project, version: 2, patternBank: bank };
}

/**
 * @param {MusicProject} project
 * @param {Partial<MusicEffects>} patch
 * @returns {MusicProject}
 */
export function updateEffects(project, patch) {
  return {
    ...project,
    version: 2,
    effects: normalizeEffects({ ...project.effects, ...patch }),
  };
}

/**
 * @param {MusicProject} project
 * @returns {MusicProject}
 */
export function clearAllPatterns(project) {
  const tracks = project.tracks.map((t) => ({
    ...t,
    pattern: emptyPattern(project.steps),
  }));
  const bank = [...project.patternBank];
  bank[project.activePattern] = snapshotPatterns(tracks);
  return { ...project, version: 2, tracks, patternBank: bank };
}

/**
 * @param {MusicProject} project
 * @param {string} trackId
 * @param {number} stepIndex
 * @returns {MusicProject}
 */
export function toggleStep(project, trackId, stepIndex) {
  const tracks = project.tracks.map((t) => {
    if (t.id !== trackId) return t;
    const pattern = [...t.pattern];
    if (stepIndex < 0 || stepIndex >= pattern.length) return t;
    pattern[stepIndex] = pattern[stepIndex] ? 0 : 1;
    return { ...t, pattern };
  });
  const bank = [...project.patternBank];
  bank[project.activePattern] = snapshotPatterns(tracks);
  return { ...project, version: 2, tracks, patternBank: bank };
}

/**
 * @param {MusicProject} project
 * @param {string} trackId
 * @param {Partial<Omit<MusicTrack, 'id' | 'pattern'>> & { pattern?: number[] }} patch
 * @returns {MusicProject}
 */
export function updateTrack(project, trackId, patch) {
  const tracks = project.tracks.map((t) => {
    if (t.id !== trackId) return t;
    return {
      ...t,
      ...patch,
      id: t.id,
      pattern: Array.isArray(patch.pattern)
        ? normalizeTrack({ ...t, ...patch }, project.steps).pattern
        : t.pattern,
    };
  });
  const bank = [...project.patternBank];
  if (Array.isArray(patch.pattern)) {
    bank[project.activePattern] = snapshotPatterns(tracks);
  }
  return { ...project, version: 2, tracks, patternBank: bank };
}
