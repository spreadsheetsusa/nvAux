import { v4 as uuidv4 } from 'uuid';

import { parseNoteMeta, serializeNoteMeta } from '../parseNoteMeta';

export const MS = {
  SECOND: 1000,
  MINUTE: 60_000,
  HOUR: 3_600_000,
  DAY: 86_400_000,
  WEEK: 604_800_000,
};

/** @typedef {'calendar' | 'relative'} TimelineMode */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   color?: string,
 * }} TimelineLane
 */

/**
 * @typedef {{
 *   id: string,
 *   laneId: string,
 *   title: string,
 *   startMs: number,
 *   endMs: number,
 *   alert?: boolean,
 *   color?: string,
 * }} TimelineItem
 */

/**
 * @typedef {{
 *   version: number,
 *   mode: TimelineMode,
 *   durationMs: number,
 *   viewStartMs: number,
 *   pxPerMs: number,
 *   playheadMs: number,
 *   anchorDate: string | null,
 *   useBirthAnchor: boolean,
 *   lanes: TimelineLane[],
 *   items: TimelineItem[],
 * }} TimelineProject
 */

/** @typedef {{ accent?: string }} TimelineTheme */

export const MIN_ITEM_MS = 5 * MS.MINUTE;
export const MIN_PX_PER_MS = 1 / MS.DAY;
export const MAX_PX_PER_MS = 4 / MS.MINUTE;
export const DEFAULT_RELATIVE_DURATION_MS = 8 * MS.HOUR;
export const DEFAULT_PX_PER_MS_RELATIVE = 80 / MS.HOUR;
export const DEFAULT_PX_PER_MS_CALENDAR = 48 / MS.HOUR;

/** @param {string} [prefix] */
function newId(prefix = 'id') {
  return `${prefix}_${uuidv4().slice(0, 8)}`;
}

/** @returns {string} */
export function createLaneId() {
  return newId('lane');
}

/** @returns {string} */
export function createItemId() {
  return newId('item');
}

/**
 * Local YYYY-MM-DD → start-of-day epoch ms.
 * @param {string} isoDate
 * @returns {number | null}
 */
export function dateToStartMs(isoDate) {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return null;
  }
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  const ms = dt.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * @param {number} ms
 * @returns {string}
 */
export function msToLocalIso(ms) {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return '';
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Parse ISO-ish local datetime (with or without Z) to epoch ms.
 * @param {unknown} value
 * @returns {number | null}
 */
export function parseTimeValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return dateToStartMs(raw);
  const m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/
  );
  if (m) {
    const dt = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6] || 0),
      0
    );
    const ms = dt.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** @returns {TimelineProject} */
export function emptyRelativeProject() {
  const laneA = { id: createLaneId(), name: 'Planning' };
  const laneB = { id: createLaneId(), name: 'Execution' };
  const laneC = { id: createLaneId(), name: 'Review' };
  return {
    version: 1,
    mode: 'relative',
    durationMs: DEFAULT_RELATIVE_DURATION_MS,
    viewStartMs: 0,
    pxPerMs: DEFAULT_PX_PER_MS_RELATIVE,
    playheadMs: 0,
    anchorDate: null,
    useBirthAnchor: false,
    lanes: [laneA, laneB, laneC],
    items: [
      {
        id: createItemId(),
        laneId: laneA.id,
        title: 'Scope & goals',
        startMs: 0,
        endMs: 45 * MS.MINUTE,
        alert: false,
      },
      {
        id: createItemId(),
        laneId: laneB.id,
        title: 'Build the thing',
        startMs: 30 * MS.MINUTE,
        endMs: 3 * MS.HOUR,
        alert: true,
      },
      {
        id: createItemId(),
        laneId: laneC.id,
        title: 'Wrap-up check',
        startMs: 3 * MS.HOUR,
        endMs: 3.5 * MS.HOUR,
        alert: true,
      },
    ],
  };
}

/** @returns {TimelineProject} */
export function emptyCalendarProject() {
  const laneA = { id: createLaneId(), name: 'Track A' };
  const laneB = { id: createLaneId(), name: 'Track B' };
  const day = new Date();
  day.setHours(9, 0, 0, 0);
  const base = day.getTime();
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  return {
    version: 1,
    mode: 'calendar',
    durationMs: MS.DAY,
    viewStartMs: base - MS.HOUR,
    pxPerMs: DEFAULT_PX_PER_MS_CALENDAR,
    playheadMs: base,
    anchorDate: `${y}-${m}-${d}`,
    useBirthAnchor: false,
    lanes: [laneA, laneB],
    items: [
      {
        id: createItemId(),
        laneId: laneA.id,
        title: 'Morning block',
        startMs: base,
        endMs: base + 2 * MS.HOUR,
        alert: false,
      },
      {
        id: createItemId(),
        laneId: laneB.id,
        title: 'Deep work',
        startMs: base + 2.5 * MS.HOUR,
        endMs: base + 5 * MS.HOUR,
        alert: false,
      },
    ],
  };
}

export const emptyTimelineProject = emptyRelativeProject;

/** @returns {string} */
export function defaultTimelineBody() {
  return serializeTimelineNote({}, emptyRelativeProject());
}

/**
 * @param {unknown} raw
 * @returns {TimelineLane}
 */
function normalizeLane(raw) {
  const o = raw && typeof raw === 'object' ? /** @type {any} */ (raw) : {};
  return {
    id: typeof o.id === 'string' && o.id ? o.id : createLaneId(),
    name: typeof o.name === 'string' && o.name.trim() ? o.name.trim() : 'Lane',
    ...(typeof o.color === 'string' && o.color ? { color: o.color } : {}),
  };
}

/**
 * @param {unknown} raw
 * @param {TimelineMode} mode
 * @returns {TimelineItem | null}
 */
function normalizeItem(raw, mode) {
  const o = raw && typeof raw === 'object' ? /** @type {any} */ (raw) : {};
  if (typeof o.laneId !== 'string' || !o.laneId) return null;

  let startMs = null;
  let endMs = null;
  if (mode === 'calendar') {
    startMs = parseTimeValue(o.start ?? o.startMs);
    endMs = parseTimeValue(o.end ?? o.endMs);
  } else {
    startMs =
      typeof o.startMs === 'number'
        ? o.startMs
        : parseTimeValue(o.startMs ?? o.start);
    endMs =
      typeof o.endMs === 'number' ? o.endMs : parseTimeValue(o.endMs ?? o.end);
  }
  if (startMs == null || endMs == null) return null;
  if (endMs < startMs + MIN_ITEM_MS) endMs = startMs + MIN_ITEM_MS;

  return {
    id: typeof o.id === 'string' && o.id ? o.id : createItemId(),
    laneId: o.laneId,
    title:
      typeof o.title === 'string' && o.title.trim() ? o.title.trim() : 'Untitled',
    startMs,
    endMs,
    alert: !!o.alert,
    ...(typeof o.color === 'string' && o.color ? { color: o.color } : {}),
  };
}

/**
 * @param {unknown} raw
 * @returns {TimelineProject}
 */
export function normalizeProject(raw) {
  const o = raw && typeof raw === 'object' ? /** @type {any} */ (raw) : {};
  const mode = o.mode === 'calendar' ? 'calendar' : 'relative';
  const lanesRaw = Array.isArray(o.lanes) ? o.lanes : [];
  let lanes = lanesRaw.map(normalizeLane).filter(Boolean);
  if (!lanes.length) {
    lanes = [
      { id: createLaneId(), name: 'Lane 1' },
      { id: createLaneId(), name: 'Lane 2' },
    ];
  }
  const laneIds = new Set(lanes.map((l) => l.id));
  const items = (Array.isArray(o.items) ? o.items : [])
    .map((it) => normalizeItem(it, mode))
    .filter((it) => it && laneIds.has(it.laneId));

  let durationMs =
    typeof o.durationMs === 'number' && o.durationMs > 0
      ? o.durationMs
      : DEFAULT_RELATIVE_DURATION_MS;
  if (mode === 'relative') {
    const maxEnd = items.reduce((m, i) => Math.max(m, i.endMs), 0);
    durationMs = Math.max(durationMs, MS.HOUR, maxEnd);
  }

  let pxPerMs =
    typeof o.pxPerMs === 'number' && o.pxPerMs > 0
      ? o.pxPerMs
      : mode === 'calendar'
        ? DEFAULT_PX_PER_MS_CALENDAR
        : DEFAULT_PX_PER_MS_RELATIVE;
  pxPerMs = Math.min(MAX_PX_PER_MS, Math.max(MIN_PX_PER_MS, pxPerMs));

  let viewStartMs =
    typeof o.viewStartMs === 'number' && Number.isFinite(o.viewStartMs)
      ? o.viewStartMs
      : mode === 'calendar'
        ? (items[0]?.startMs ?? Date.now()) - MS.HOUR
        : 0;

  let playheadMs =
    typeof o.playheadMs === 'number' && Number.isFinite(o.playheadMs)
      ? o.playheadMs
      : mode === 'relative'
        ? 0
        : viewStartMs;

  const anchorDate =
    typeof o.anchorDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.anchorDate)
      ? o.anchorDate
      : null;

  return {
    version: 1,
    mode,
    durationMs,
    viewStartMs,
    pxPerMs,
    playheadMs,
    anchorDate,
    useBirthAnchor: !!o.useBirthAnchor,
    lanes,
    items,
  };
}

/**
 * @param {string | null | undefined} body
 * @returns {{ theme: TimelineTheme, project: TimelineProject, parseError: string | null }}
 */
export function parseTimelineNote(body) {
  const meta = parseNoteMeta(body ?? '');
  /** @type {TimelineTheme} */
  const theme = {};
  if (meta.theme?.accent) theme.accent = meta.theme.accent;

  const raw = (meta.bodyWithoutMeta || '').trim();
  if (!raw) {
    return { theme, project: emptyRelativeProject(), parseError: null };
  }

  try {
    const parsed = JSON.parse(raw);
    return { theme, project: normalizeProject(parsed), parseError: null };
  } catch (err) {
    return {
      theme,
      project: emptyRelativeProject(),
      parseError: err instanceof Error ? err.message : 'Invalid timeline JSON',
    };
  }
}

/**
 * Serialize for Edit-mode readability: calendar uses ISO start/end;
 * relative uses startMs/endMs.
 * @param {TimelineTheme | null | undefined} theme
 * @param {TimelineProject} project
 * @returns {string}
 */
export function serializeTimelineNote(theme, project) {
  const p = normalizeProject(project);
  const items = p.items.map((it) => {
    if (p.mode === 'calendar') {
      return {
        id: it.id,
        laneId: it.laneId,
        title: it.title,
        start: msToLocalIso(it.startMs),
        end: msToLocalIso(it.endMs),
        ...(it.alert ? { alert: true } : {}),
        ...(it.color ? { color: it.color } : {}),
      };
    }
    return {
      id: it.id,
      laneId: it.laneId,
      title: it.title,
      startMs: Math.round(it.startMs),
      endMs: Math.round(it.endMs),
      ...(it.alert ? { alert: true } : {}),
      ...(it.color ? { color: it.color } : {}),
    };
  });

  const payload = {
    version: 1,
    mode: p.mode,
    durationMs: Math.round(p.durationMs),
    viewStartMs: Math.round(p.viewStartMs),
    pxPerMs: p.pxPerMs,
    playheadMs: Math.round(p.playheadMs),
    anchorDate: p.anchorDate,
    useBirthAnchor: p.useBirthAnchor,
    lanes: p.lanes.map((l) => ({
      id: l.id,
      name: l.name,
      ...(l.color ? { color: l.color } : {}),
    })),
    items,
  };

  const meta = {
    type: 'timeline',
    ...(theme?.accent ? { theme: { accent: theme.accent } } : {}),
  };
  return serializeNoteMeta(meta, `${JSON.stringify(payload, null, 2)}\n`);
}

/** @param {string} [name] */
export function createLane(name = 'New lane') {
  return { id: createLaneId(), name };
}

/**
 * @param {string} laneId
 * @param {number} startMs
 * @param {number} endMs
 * @param {string} [title]
 */
export function createItem(laneId, startMs, endMs, title = 'New step') {
  const start = startMs;
  const end = Math.max(endMs, start + MIN_ITEM_MS);
  return {
    id: createItemId(),
    laneId,
    title,
    startMs: start,
    endMs: end,
    alert: false,
  };
}

/**
 * @param {TimelineProject} project
 * @param {TimelineMode} mode
 * @param {{ birthDate?: string }} [opts]
 */
export function setMode(project, mode, opts = {}) {
  if (project.mode === mode) return project;
  if (mode === 'relative') {
    const minStart = project.items.reduce(
      (m, it) => Math.min(m, it.startMs),
      project.items[0]?.startMs ?? 0
    );
    const items = project.items.map((it) => ({
      ...it,
      startMs: it.startMs - minStart,
      endMs: it.endMs - minStart,
    }));
    const durationMs = Math.max(
      DEFAULT_RELATIVE_DURATION_MS,
      ...items.map((i) => i.endMs),
      MS.HOUR
    );
    return {
      ...project,
      mode: 'relative',
      durationMs,
      viewStartMs: 0,
      pxPerMs: DEFAULT_PX_PER_MS_RELATIVE,
      playheadMs: 0,
      items,
    };
  }

  let anchor = project.anchorDate;
  if (project.useBirthAnchor && opts.birthDate) anchor = opts.birthDate;
  const dayStart =
    dateToStartMs(anchor || '') ??
    (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })();
  const base = dayStart + 9 * MS.HOUR;
  const items = project.items.map((it) => ({
    ...it,
    startMs: base + it.startMs,
    endMs: base + it.endMs,
  }));
  const y = new Date(dayStart);
  const anchorDate = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  return {
    ...project,
    mode: 'calendar',
    anchorDate: project.anchorDate || anchorDate,
    viewStartMs: base - MS.HOUR,
    pxPerMs: DEFAULT_PX_PER_MS_CALENDAR,
    playheadMs: base,
    items,
  };
}

/**
 * @param {TimelineProject} project
 * @param {Partial<TimelineItem> & { id: string }} patch
 */
export function updateItem(project, patch) {
  return {
    ...project,
    items: project.items.map((it) => {
      if (it.id !== patch.id) return it;
      const next = { ...it, ...patch };
      if (next.endMs < next.startMs + MIN_ITEM_MS) {
        next.endMs = next.startMs + MIN_ITEM_MS;
      }
      return next;
    }),
  };
}

/**
 * @param {TimelineProject} project
 * @param {string} itemId
 * @param {number} deltaMs
 * @param {'move' | 'resize-start' | 'resize-end'} kind
 */
export function shiftItem(project, itemId, deltaMs, kind) {
  return {
    ...project,
    items: project.items.map((it) => {
      if (it.id !== itemId) return it;
      if (kind === 'move') {
        let startMs = it.startMs + deltaMs;
        let endMs = it.endMs + deltaMs;
        if (project.mode === 'relative') {
          if (startMs < 0) {
            endMs -= startMs;
            startMs = 0;
          }
        }
        return { ...it, startMs, endMs };
      }
      if (kind === 'resize-start') {
        let startMs = Math.min(it.startMs + deltaMs, it.endMs - MIN_ITEM_MS);
        if (project.mode === 'relative') startMs = Math.max(0, startMs);
        return { ...it, startMs };
      }
      const endMs = Math.max(it.endMs + deltaMs, it.startMs + MIN_ITEM_MS);
      return { ...it, endMs };
    }),
  };
}
