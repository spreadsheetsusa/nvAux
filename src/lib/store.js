import { writable, get } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';

import { addRxPlugin, createRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

import { schema } from './schema';
import { applyAccentGradient } from '../utils/accentGradient';
import { defaultKanbanBody } from './noteTypes/kanban/kanbanModel';
import {
  applyLockedMeta,
  applyStickyMeta,
  getStickyColor,
  isNoteLocked,
  isNoteSticky,
  normalizeStickyColor,
} from './noteTypes/parseNoteMeta';
import { isRichNoteType, resolveNoteType } from './noteTypes/resolveNoteType';
import { clampFramePosition, clampFrameRect } from '../utils/clampFrame';

/**
 * State that persists to localStorage =========================================
 */

const storedNoteListHeight = localStorage.getItem('noteListHeight') || 220;
const storedSidebarWidth = localStorage.getItem('sidebarWidth') || 443;
const storedMediaViewerHeight = (() => {
  const raw = Number(localStorage.getItem('mediaViewerHeight'));
  return Number.isFinite(raw) ? Math.min(480, Math.max(120, raw)) : 220;
})();

/** @param {string} key @param {boolean} fallback */
function readStoredBool(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return !!JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const storedGraphViewHeight = localStorage.getItem('graphViewHeight') || 260;
const storedGraphViewOpen = readStoredBool('graphViewOpen', false);
const storedGraphViewZoom = (() => {
  const raw = Number(localStorage.getItem('graphViewZoom'));
  return Number.isFinite(raw) ? Math.min(8, Math.max(0.35, raw)) : 1;
})();

const storedFullScreen = readStoredBool('fullScreen', false);
/** Windowed app mode; migrated from inverted legacy `maximumFullScreen`. */
const storedWindowed = (() => {
  const raw = localStorage.getItem('windowed');
  if (raw !== null) return readStoredBool('windowed', false);
  const legacy = localStorage.getItem('maximumFullScreen');
  if (legacy !== null) {
    try {
      return !JSON.parse(legacy);
    } catch {
      return false;
    }
  }
  return false;
})();
/** Matches StatusBar / mobile drawer breakpoint. */
export const MOBILE_BREAKPOINT = 768;
const mobileMq =
  typeof window !== 'undefined'
    ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    : null;
const storedShowClock = JSON.parse(localStorage.getItem('showClock')) || "true";
const storedShowStatusBar = readStoredBool('showStatusBar', false);
const storedSidebarOpen = readStoredBool('sidebarOpen', false);
/** Preview vs Edit prefs by kind (plain markdown vs rich body types). Old `markdownPreview` key ignored. */
const storedMarkdownPreviewPlain = readStoredBool('markdownPreviewPlain', false);
const storedMarkdownPreviewRich = readStoredBool('markdownPreviewRich', true);
const storedBirthDate = localStorage.getItem('birthDate') || '1982-05-24';
const storedExpectedLongevity = localStorage.getItem('expectedLongevity') || '80';
/** Exactly 6 digits, or empty when unset. */
export const LOCK_PIN_RE = /^\d{6}$/;
const storedLockPin = (() => {
  const raw = localStorage.getItem('lockPin') || '';
  return LOCK_PIN_RE.test(raw) ? raw : '';
})();
/** Inactivity auto-relock delay in seconds; 0 = never. */
const LOCK_TIMEOUT_MAX = 3600;
const LOCK_TIMEOUT_STEP = 15;
const storedLockTimeoutSeconds = (() => {
  const raw = Number(localStorage.getItem('lockTimeoutSeconds'));
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const clamped = Math.min(LOCK_TIMEOUT_MAX, Math.max(0, raw));
  return Math.round(clamped / LOCK_TIMEOUT_STEP) * LOCK_TIMEOUT_STEP;
})();
const LIFE_CALENDAR_STATS = [
  'title',
  'yearsOld',
  'percentLived',
  'yearsLived',
  'percentRemaining',
  'yearsRemaining',
];
const LIFE_CALENDAR_STAT_PREF_VERSION = '2';
if (localStorage.getItem('lifeCalendarStatPrefVersion') !== LIFE_CALENDAR_STAT_PREF_VERSION) {
  localStorage.setItem('lifeCalendarStat', 'title');
  localStorage.setItem('lifeCalendarStatPrefVersion', LIFE_CALENDAR_STAT_PREF_VERSION);
}
const storedLifeCalendarStat = LIFE_CALENDAR_STATS.includes(localStorage.getItem('lifeCalendarStat'))
  ? localStorage.getItem('lifeCalendarStat')
  : 'title';

export const DEFAULT_ACCENT_COLOR = '#ed0178';
export const ACCENT_COLOR_PRESETS = [
  '#ed0178',
  '#2252a0',
  '#0f766e',
  '#c2410c',
  '#7c3aed',
];

/** @param {unknown} raw */
function normalizeAccentColor(raw) {
  if (typeof raw !== 'string') return DEFAULT_ACCENT_COLOR;
  const v = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  return DEFAULT_ACCENT_COLOR;
}

const storedAccentColor = normalizeAccentColor(localStorage.getItem('accentColor'));

/** Fixed sticky post-it size (App Windowed). */
export const STICKY_NOTE_W = 240;
export const STICKY_NOTE_H = 260;

/** @param {unknown} raw */
function parseAppWindowFrame(raw) {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (
      !v ||
      typeof v.left !== 'number' ||
      typeof v.top !== 'number' ||
      typeof v.width !== 'number' ||
      typeof v.height !== 'number'
    ) {
      return null;
    }
    return clampFrameRect(v, { minWidth: 360, minHeight: 300 });
  } catch {
    return null;
  }
}

const storedAppWindowFrame = parseAppWindowFrame(localStorage.getItem('appWindowFrame'));

/** @param {unknown} raw */
function parseStickyNoteFrames(raw) {
  /** @type {Record<string, { left: number, top: number }>} */
  const out = {};
  if (!raw) return out;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object') return out;
    for (const [guid, pos] of Object.entries(v)) {
      if (
        !pos ||
        typeof pos.left !== 'number' ||
        typeof pos.top !== 'number'
      ) {
        continue;
      }
      out[guid] = clampFramePosition(
        { left: pos.left, top: pos.top },
        { width: STICKY_NOTE_W, height: STICKY_NOTE_H }
      );
    }
  } catch {
    /* ignore */
  }
  return out;
}

const storedStickyNoteFrames = parseStickyNoteFrames(
  localStorage.getItem('stickyNoteFrames')
);

/**
 * RxDB ************************************************************************
 */

/** Bumped with RxDB 17 schema (indexed fields must be required). */
const DB_NAME = 'nvauxdb17';

/** Seeded Settings note — also the target for preference `updatedAt` bumps. */
export const SETTINGS_GUID = '00000000-0000-0000-0000-000000000000';

let dbPromise;

const _create = async () => {
  const isDev = import.meta.env.DEV;

  if (isDev) {
    const { RxDBDevModePlugin } = await import('rxdb/plugins/dev-mode');
    addRxPlugin(RxDBDevModePlugin);
  }

  const baseStorage = getRxStorageDexie();
  const storage = isDev
    ? (await import('rxdb/plugins/validate-ajv')).wrappedValidateAjvStorage({
        storage: baseStorage,
      })
    : baseStorage;

  const db = await createRxDatabase({
    name: DB_NAME,
    storage,
    ignoreDuplicate: isDev,
  });

  await db.addCollections({ notes: { schema } });

  const WELCOME_GUID = '11111111-1111-1111-1111-111111111111';
  const TECHNO_LEAGUE_GUID = '22222222-2222-2222-2222-222222222222';
  const KANBAN_DEMO_GUID = '33333333-3333-3333-3333-333333333333';
  const VIDEO_DEMO_GUID = '44444444-4444-4444-4444-444444444444';

  const welcomeNote = await db.notes.findOne(WELCOME_GUID).exec();
  if (!welcomeNote) {
    await db.notes.insert({
      guid: WELCOME_GUID,
      name: '🚀 Welcome to nvAux!',
      body: `Welcome and thank you for using nvAux!

This is a web-based note-taking app inspired by nvALT where searching and creating notes is one in the same action. A few things to keep in-mind:

* All your notes are stored within your browser, locally (and unencrypted for now).
* Do no trust your data here yet. Not production-ready. Thar be dragons.
* 'Add to Home Screen' on iOS Safari for a native app-like experience.
* Notes can be typed: open **📋 Sample Kanban** for a board (Preview = board, Edit = source). SoundCloud, YouTube, and image/video links queue into the media player — try **🎧 The Gentleman's Techno League - EP1** and **🎥 Video Link Example**.

If you are interested in the development of nvAux the project is open-source and available on GitHub at https://github.com/matterofabstract/nvaux

You can download your notes at any time by clicking the 'Download Notes' button in the nvAux settings screen.

Don't forget to follow the project on 𝕏 at @nvAuxApp and let us know what you think!
  `,
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
    });
  }

  // Always make sure the Settings Note exists
  const settingsNote = await db.notes.findOne(SETTINGS_GUID).exec();
  if (!settingsNote) {
    await db.notes.insert({
      guid: SETTINGS_GUID,
      name: '⚙️ nvAux Settings',
      body: 'Adjust Your nvAux Preferences',
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
    });
  }

  const technoLeagueNote = await db.notes.findOne(TECHNO_LEAGUE_GUID).exec();
  if (!technoLeagueNote) {
    await db.notes.insert({
      guid: TECHNO_LEAGUE_GUID,
      name: "🎧 The Gentleman's Techno League - EP1",
      body: `This note demonstrates soundcloud integration. Any notes containing soundcloud links will be detected and you'll see player/playlist buttons just above this paragraph. The media player is independant of any selected note, so feel free to queue up tracks across many notes and keep hustling.

# Episode 1

1. [Paluma Sound - Real Flow](https://soundcloud.com/chezcritique/paluma-sound-real-flow?in=frankneuro/sets/gentlemens-techno-league/)
2. [Ross From Friends - Talk To Me, You'll Understand](https://soundcloud.com/rossfromfriends/talk-to-me-youll-understand?in=frankneuro/sets/gentlemens-techno-league/)
3. [octn - on2 4u](https://soundcloud.com/octn/on2-4u?in=frankneuro/sets/gentlemens-techno-league/)
4. [Forcesupreme - Mojito](https://soundcloud.com/forcesupreme-music/forcesupreme-mojito?in=frankneuro/sets/gentlemens-techno-league/)

---

The current implementation is basic. There are future plans to support the full soundcloud api with ability to download and store media automatically.
`,
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
    });
  }

  const kanbanDemoNote = await db.notes.findOne(KANBAN_DEMO_GUID).exec();
  if (!kanbanDemoNote) {
    await db.notes.insert({
      guid: KANBAN_DEMO_GUID,
      name: '📋 Sample Kanban',
      body: defaultKanbanBody(),
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
    });
  }

  const videoDemoNote = await db.notes.findOne(VIDEO_DEMO_GUID).exec();
  if (!videoDemoNote) {
    await db.notes.insert({
      guid: VIDEO_DEMO_GUID,
      name: '🎥 Video Link Example',
      body: `Notes that contains links to video media are playable in nvAux. Click Play Now just above.

https://www.youtube.com/watch?v=Hm3JodBR-vs
`,
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
    });
  }

  return db;
};

/** Single shared DB open — must assign the promise immediately to avoid concurrent creates. */
export const db = () => {
  if (!dbPromise) {
    dbPromise = _create().catch((err) => {
      dbPromise = undefined;
      throw err;
    });
  }
  return dbPromise;
};

/** Wipe IndexedDB + prefs so the next open re-seeds the default notes. */
export async function resetDatabase() {
  const database = await db();
  await database.remove();
  dbPromise = undefined;
  localStorage.clear();
  invalidateWikiNoteNames();
}

/** Unregister service workers and clear Cache Storage. Notes and prefs are kept. */
export async function hardRefreshApp() {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

/**
 * Svelte Writables ************************************************************
 */

export const omniMode = writable('search');
export const omniText = writable('');
export const noteList = writable([]);
export const noteListHeight = writable(Number(storedNoteListHeight));
export const sidebarWidth = writable(Number(storedSidebarWidth));
export const graphViewOpen = writable(storedGraphViewOpen);
export const graphViewHeight = writable(Number(storedGraphViewHeight));
export const graphViewZoom = writable(storedGraphViewZoom);
export const selectedNote = writable({});
export const bodyText = writable('');
/** Active Preview/Edit UI flag; synced from per-kind prefs via {@link syncMarkdownPreviewForNoteType}. */
export const markdownPreview = writable(storedMarkdownPreviewPlain);
const markdownPreviewPlain = writable(storedMarkdownPreviewPlain);
const markdownPreviewRich = writable(storedMarkdownPreviewRich);

/**
 * Load the active preview toggle from the pref for this note kind.
 * No-op for empty/settings.
 * @param {import('./noteTypes/resolveNoteType').NoteType | string | null | undefined} type
 */
export function syncMarkdownPreviewForNoteType(type) {
  if (type === 'markdown') {
    markdownPreview.set(get(markdownPreviewPlain));
    return;
  }
  if (isRichNoteType(type)) {
    markdownPreview.set(get(markdownPreviewRich));
  }
}

/**
 * Flip Preview/Edit for the active note kind and persist that kind's pref.
 * @param {import('./noteTypes/resolveNoteType').NoteType | string | null | undefined} type
 */
export function toggleMarkdownPreviewForNoteType(type) {
  if (type === 'markdown') {
    const next = !get(markdownPreviewPlain);
    markdownPreviewPlain.set(next);
    markdownPreview.set(next);
    return;
  }
  if (isRichNoteType(type)) {
    const next = !get(markdownPreviewRich);
    markdownPreviewRich.set(next);
    markdownPreview.set(next);
  }
}

export const fullScreen = writable(storedFullScreen);
/** App Mode floating window (vs edge-to-edge fullscreen). Desktop only. */
export const windowed = writable(storedWindowed);
/** True when viewport is at or below {@link MOBILE_BREAKPOINT}. */
export const isMobile = writable(mobileMq ? mobileMq.matches : false);
export const showClock = writable(storedShowClock);
export const showStatusBar = writable(storedShowStatusBar);
export const sidebarOpen = writable(storedSidebarOpen);

if (mobileMq) {
  const syncMobile = () => isMobile.set(mobileMq.matches);
  // Safari < 14 used addListener; prefer addEventListener.
  if (typeof mobileMq.addEventListener === 'function') {
    mobileMq.addEventListener('change', syncMobile);
  } else if (typeof mobileMq.addListener === 'function') {
    mobileMq.addListener(syncMobile);
  }
}

// Windowed is desktop-only — drop it as soon as we enter a mobile viewport.
isMobile.subscribe((mobile) => {
  if (mobile) windowed.set(false);
});
export const birthDate = writable(storedBirthDate);
export const expectedLongevity = writable(storedExpectedLongevity);
export const lifeCalendarStat = writable(storedLifeCalendarStat);
export const LIFE_CALENDAR_STAT_MODES = LIFE_CALENDAR_STATS;
export const accentColor = writable(storedAccentColor);
export const lockPin = writable(storedLockPin);
export const lockTimeoutSeconds = writable(storedLockTimeoutSeconds);
/** Session-only: scroll Settings Lock section + show setup notice. */
export const settingsLockFocus = writable(false);
/**
 * Session unlocks for locked notes: guid → last activity timestamp (ms).
 * Cleared on reload; inactivity may remove entries when timeout > 0.
 * @type {import('svelte/store').Writable<Record<string, number>>}
 */
export const unlockedNoteActivity = writable({});

accentColor.subscribe((v) => {
  if (typeof document === 'undefined') return;
  const hex = normalizeAccentColor(v);
  document.documentElement.style.setProperty('--app-accent', hex);
  applyAccentGradient(hex);
});

// Re-seed gradient when light/dark preference flips.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const schemeMq = window.matchMedia('(prefers-color-scheme: dark)');
  const onSchemeChange = () => {
    applyAccentGradient(normalizeAccentColor(get(accentColor)));
  };
  if (typeof schemeMq.addEventListener === 'function') {
    schemeMq.addEventListener('change', onSchemeChange);
  } else if (typeof schemeMq.addListener === 'function') {
    schemeMq.addListener(onSchemeChange);
  }
}
/** Height of the media player bar under the Omnibar (0 when hidden). */
export const mediaPlayerHeight = writable(0);
/** Resizable image/video viewer pane above the media player bar. */
export const mediaViewerHeight = writable(storedMediaViewerHeight);

/**
 * Session floating note windows (App Windowed): resizable popups + fixed stickies.
 * @type {import('svelte/store').Writable<Array<{
 *   id: string,
 *   guid: string,
 *   kind: 'popup' | 'sticky',
 *   color?: 'yellow' | 'pink' | 'blue',
 *   left: number,
 *   top: number,
 *   width: number,
 *   height: number,
 *   zIndex: number,
 * }>>}
 */
export const notePopups = writable([]);

/** Persisted main App Windowed geometry (null = use default). */
export const appWindowFrame = writable(storedAppWindowFrame);

/** Persisted sticky positions keyed by note guid. */
export const stickyNoteFrames = writable(storedStickyNoteFrames);

/** Z-order for the main App Windowed card (competes with note popups). */
export const mainWindowZIndex = writable(10);

const POPUP_DEFAULT_W = 420;
const POPUP_DEFAULT_H = 320;
const POPUP_CASCADE = 28;
/** Shared front-to-back counter for main window + note popups (macOS-style). */
let windowStackZ = 10;

function nextWindowZ() {
  windowStackZ += 1;
  return windowStackZ;
}

/** Bring the main app window above all note popups. */
export function raiseMainWindow() {
  if (get(mainWindowZIndex) === windowStackZ) return;
  mainWindowZIndex.set(nextWindowZ());
}

/**
 * @param {{ left: number, top: number, width: number, height: number }} rect
 */
export function persistAppWindowFrame(rect) {
  if (!rect) return;
  const next = clampFrameRect(rect, { minWidth: 360, minHeight: 300 });
  appWindowFrame.set(next);
}

/**
 * @param {string} guid
 * @param {{ left: number, top: number }} pos
 */
export function persistStickyNoteFrame(guid, pos) {
  if (!guid || !pos) return;
  const next = clampFramePosition(pos, {
    width: STICKY_NOTE_W,
    height: STICKY_NOTE_H,
  });
  stickyNoteFrames.update((map) => ({ ...map, [guid]: next }));
}

/** Re-clamp persisted frames after viewport changes. */
export function clampPersistedFramesToViewport() {
  const frame = get(appWindowFrame);
  if (frame) {
    appWindowFrame.set(clampFrameRect(frame, { minWidth: 360, minHeight: 300 }));
  }
  stickyNoteFrames.update((map) => {
    /** @type {Record<string, { left: number, top: number }>} */
    const next = {};
    for (const [guid, pos] of Object.entries(map)) {
      next[guid] = clampFramePosition(pos, {
        width: STICKY_NOTE_W,
        height: STICKY_NOTE_H,
      });
    }
    return next;
  });
  notePopups.update((list) =>
    list.map((p) => {
      if (p.kind === 'sticky') {
        const pos = clampFramePosition(
          { left: p.left, top: p.top },
          { width: STICKY_NOTE_W, height: STICKY_NOTE_H }
        );
        return {
          ...p,
          left: pos.left,
          top: pos.top,
          width: STICKY_NOTE_W,
          height: STICKY_NOTE_H,
        };
      }
      const rect = clampFrameRect(
        { left: p.left, top: p.top, width: p.width, height: p.height },
        { minWidth: 280, minHeight: 200 }
      );
      return { ...p, ...rect };
    })
  );
}

/**
 * Default cascade position for a new sticky.
 * @param {number} index
 */
function defaultStickyPos(index) {
  const left = Math.max(
    16,
    Math.round(window.innerWidth * 0.08) + index * POPUP_CASCADE
  );
  const top = Math.max(
    16,
    Math.round(window.innerHeight * 0.12) + index * POPUP_CASCADE
  );
  return clampFramePosition(
    { left, top },
    { width: STICKY_NOTE_W, height: STICKY_NOTE_H }
  );
}

/**
 * Ensure a sticky floater exists for guid (raise if already open).
 * @param {string} guid
 * @param {{ color?: string, body?: string }} [opts]
 */
export function ensureStickyPopup(guid, opts = {}) {
  if (!guid) return;
  const color =
    normalizeStickyColor(opts.color ?? '') ??
    (opts.body != null ? getStickyColor(opts.body) : 'yellow');
  const frames = get(stickyNoteFrames);

  notePopups.update((list) => {
    const existing = list.find((p) => p.guid === guid);
    if (existing) {
      const z = nextWindowZ();
      return list.map((p) =>
        p.id === existing.id
          ? {
              ...p,
              kind: 'sticky',
              color,
              width: STICKY_NOTE_W,
              height: STICKY_NOTE_H,
              zIndex: z,
            }
          : p
      );
    }
    const stickyCount = list.filter((p) => p.kind === 'sticky').length;
    const saved = frames[guid];
    const pos = saved
      ? clampFramePosition(saved, {
          width: STICKY_NOTE_W,
          height: STICKY_NOTE_H,
        })
      : defaultStickyPos(stickyCount);
    return [
      ...list,
      {
        id: uuidv4(),
        guid,
        kind: 'sticky',
        color,
        left: pos.left,
        top: pos.top,
        width: STICKY_NOTE_W,
        height: STICKY_NOTE_H,
        zIndex: nextWindowZ(),
      },
    ];
  });
}

/**
 * Open a floating note popup for guid (App Windowed). Sticky notes use sticky chrome.
 * One per guid — reopens raise existing.
 * @param {string} guid
 */
export async function openNotePopup(guid) {
  if (!guid) return;
  const database = await db();
  const doc = await database.notes.findOne(guid).exec();
  const body = doc?.body ?? '';
  const sticky = doc && isNoteSticky(body) && resolveNoteType(doc, body) === 'markdown';

  if (sticky) {
    ensureStickyPopup(guid, { body, color: getStickyColor(body) });
    return;
  }

  let raised = false;
  notePopups.update((list) => {
    const existing = list.find((p) => p.guid === guid);
    if (existing) {
      raised = true;
      const z = nextWindowZ();
      // Sticky → popup when sticky was turned off mid-session.
      if (existing.kind === 'sticky') {
        const width = POPUP_DEFAULT_W;
        const height = POPUP_DEFAULT_H;
        const left = Math.max(
          16,
          Math.round((window.innerWidth - width) / 2)
        );
        const top = Math.max(
          16,
          Math.round((window.innerHeight - height) / 2)
        );
        return list.map((p) =>
          p.id === existing.id
            ? {
                ...p,
                kind: 'popup',
                color: undefined,
                left,
                top,
                width,
                height,
                zIndex: z,
              }
            : p
        );
      }
      return list.map((p) =>
        p.id === existing.id ? { ...p, zIndex: z } : p
      );
    }
    const z = nextWindowZ();
    const index = list.filter((p) => p.kind === 'popup').length;
    const width = POPUP_DEFAULT_W;
    const height = POPUP_DEFAULT_H;
    const left = Math.max(
      16,
      Math.round((window.innerWidth - width) / 2) + index * POPUP_CASCADE
    );
    const top = Math.max(
      16,
      Math.round((window.innerHeight - height) / 2) + index * POPUP_CASCADE
    );
    return [
      ...list,
      {
        id: uuidv4(),
        guid,
        kind: 'popup',
        left,
        top,
        width,
        height,
        zIndex: z,
      },
    ];
  });
  return raised;
}

/**
 * Auto-surface every sticky markdown note in App Windowed.
 * Session-dismissed stickies stay hidden until the next Windowed enter.
 */
export async function syncStickyNotes() {
  const database = await db();
  const docs = await database.notes.find().exec();
  const stickyDocs = docs.filter((doc) => {
    const body = doc.body ?? '';
    return isNoteSticky(body) && resolveNoteType(doc, body) === 'markdown';
  });

  const frames = get(stickyNoteFrames);
  const want = new Set(stickyDocs.map((d) => d.guid));

  notePopups.update((list) => {
    // Drop sticky floaters for notes that are no longer sticky.
    let next = list.filter(
      (p) => p.kind !== 'sticky' || want.has(p.guid)
    );
    let cascade = next.filter((p) => p.kind === 'sticky').length;

    for (const doc of stickyDocs) {
      const color = getStickyColor(doc.body);
      const existing = next.find((p) => p.guid === doc.guid);
      if (existing) {
        const saved = frames[doc.guid];
        const pos = saved
          ? clampFramePosition(saved, {
              width: STICKY_NOTE_W,
              height: STICKY_NOTE_H,
            })
          : {
              left: existing.left,
              top: existing.top,
            };
        next = next.map((p) =>
          p.guid === doc.guid
            ? {
                ...p,
                kind: 'sticky',
                color,
                left: pos.left,
                top: pos.top,
                width: STICKY_NOTE_W,
                height: STICKY_NOTE_H,
              }
            : p
        );
        continue;
      }
      const saved = frames[doc.guid];
      const pos = saved
        ? clampFramePosition(saved, {
            width: STICKY_NOTE_W,
            height: STICKY_NOTE_H,
          })
        : defaultStickyPos(cascade++);
      next = [
        ...next,
        {
          id: uuidv4(),
          guid: doc.guid,
          kind: 'sticky',
          color,
          left: pos.left,
          top: pos.top,
          width: STICKY_NOTE_W,
          height: STICKY_NOTE_H,
          zIndex: nextWindowZ(),
        },
      ];
    }
    return next;
  });
}

/** @returns {boolean} */
export function isLockPinSet() {
  return LOCK_PIN_RE.test(get(lockPin) || '');
}

/**
 * @param {string} pin
 * @returns {boolean}
 */
export function verifyLockPin(pin) {
  return LOCK_PIN_RE.test(pin) && pin === get(lockPin);
}

/** Open Settings and highlight the Lock section (PIN not set yet). */
export async function promptSettingsForLockPin() {
  settingsLockFocus.set(true);
  await selectNoteByGuid(SETTINGS_GUID);
}

/**
 * @param {string | null | undefined} guid
 * @returns {boolean}
 */
export function isNoteSessionUnlocked(guid) {
  if (!guid) return false;
  return get(unlockedNoteActivity)[guid] != null;
}

/**
 * @param {string} guid
 */
export function unlockNoteSession(guid) {
  if (!guid) return;
  const now = Date.now();
  unlockedNoteActivity.update((m) => ({ ...m, [guid]: now }));
}

/**
 * @param {string} guid
 */
export function lockNoteSession(guid) {
  if (!guid) return;
  unlockedNoteActivity.update((m) => {
    if (m[guid] == null) return m;
    const next = { ...m };
    delete next[guid];
    return next;
  });
}

/**
 * @param {string} guid
 */
export function touchNoteActivity(guid) {
  if (!guid) return;
  unlockedNoteActivity.update((m) => {
    if (m[guid] == null) return m;
    return { ...m, [guid]: Date.now() };
  });
}

/**
 * True when the note body may be shown (not locked, or session-unlocked).
 * @param {string | null | undefined} guid
 * @param {string | null | undefined} body
 */
export function isNoteContentAccessible(guid, body) {
  if (!isNoteLocked(body)) return true;
  return isNoteSessionUnlocked(guid);
}

// Auto-relock unlocked notes after inactivity (skipped when timeout is 0).
if (typeof window !== 'undefined') {
  window.setInterval(() => {
    const timeoutSec = Number(get(lockTimeoutSeconds));
    if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) return;
    const cutoff = Date.now() - timeoutSec * 1000;
    unlockedNoteActivity.update((m) => {
      let changed = false;
      /** @type {Record<string, number>} */
      const next = {};
      for (const [guid, last] of Object.entries(m)) {
        if (last >= cutoff) next[guid] = last;
        else changed = true;
      }
      return changed ? next : m;
    });
  }, 1000);
}

/**
 * Toggle sticky frontmatter on a note and sync Windowed floaters.
 * @param {any} noteDoc RxDB document
 * @param {boolean} sticky
 * @param {'yellow' | 'pink' | 'blue'} [color]
 */
export async function setNoteSticky(noteDoc, sticky, color) {
  if (!noteDoc?.guid || noteDoc.guid === SETTINGS_GUID) return;
  const prevBody = noteDoc.body ?? '';
  if (resolveNoteType(noteDoc, prevBody) !== 'markdown' && sticky) return;

  const nextBody = applyStickyMeta(prevBody, {
    sticky: !!sticky,
    color: color ?? getStickyColor(prevBody),
  });

  await noteDoc.incrementalModify((data) => {
    data.body = nextBody;
    data.updatedAt = Date.now();
    return data;
  });

  // Keep main editor in sync when this is the selected note.
  const selected = get(selectedNote);
  if (selected?.guid === noteDoc.guid) {
    bodyText.set(nextBody);
  }

  const inWindowed = get(fullScreen) && get(windowed) && !get(isMobile);
  if (sticky) {
    if (inWindowed) {
      ensureStickyPopup(noteDoc.guid, {
        body: nextBody,
        color: getStickyColor(nextBody),
      });
    }
  } else {
    notePopups.update((list) =>
      list.filter((p) => !(p.guid === noteDoc.guid && p.kind === 'sticky'))
    );
  }
}

/**
 * Update sticky color in frontmatter + open floater.
 * @param {any} noteDoc
 * @param {'yellow' | 'pink' | 'blue'} color
 */
export async function setStickyColor(noteDoc, color) {
  if (!noteDoc?.guid) return;
  const c = normalizeStickyColor(color);
  if (!c) return;
  const prevBody = noteDoc.body ?? '';
  if (!isNoteSticky(prevBody)) return;
  await setNoteSticky(noteDoc, true, c);
}

/**
 * Set or clear locked frontmatter on a note.
 * @param {any} noteDoc RxDB document
 * @param {boolean} locked
 */
export async function setNoteLocked(noteDoc, locked) {
  if (!noteDoc?.guid || noteDoc.guid === SETTINGS_GUID) return;
  const prevBody = noteDoc.body ?? '';
  const nextBody = applyLockedMeta(prevBody, !!locked);

  await noteDoc.incrementalModify((data) => {
    data.body = nextBody;
    data.updatedAt = Date.now();
    return data;
  });

  const selected = get(selectedNote);
  if (selected?.guid === noteDoc.guid) {
    bodyText.set(nextBody);
  }

  // Locking or clearing always drops any open session unlock.
  lockNoteSession(noteDoc.guid);
}

/** @param {string} id */
export function closeNotePopup(id) {
  if (!id) return;
  notePopups.update((list) => list.filter((p) => p.id !== id));
}

export function closeAllNotePopups() {
  notePopups.set([]);
}

/** Bring a note popup above the main window and all other popups. */
export function raiseNotePopup(id) {
  if (!id) return;
  notePopups.update((list) => {
    const target = list.find((p) => p.id === id);
    if (!target) return list;
    // Already the global frontmost window — skip store churn mid-drag.
    if (target.zIndex === windowStackZ) return list;
    const z = nextWindowZ();
    return list.map((p) => (p.id === id ? { ...p, zIndex: z } : p));
  });
}

/**
 * Sync geometry after drag/resize.
 * @param {string} id
 * @param {{ left: number, top: number, width: number, height: number }} rect
 */
export function updateNotePopupRect(id, rect) {
  if (!id || !rect) return;
  notePopups.update((list) => {
    const target = list.find((p) => p.id === id);
    if (!target) return list;
    if (target.kind === 'sticky') {
      const pos = clampFramePosition(
        { left: rect.left, top: rect.top },
        { width: STICKY_NOTE_W, height: STICKY_NOTE_H }
      );
      persistStickyNoteFrame(target.guid, pos);
      return list.map((p) =>
        p.id === id
          ? {
              ...p,
              left: pos.left,
              top: pos.top,
              width: STICKY_NOTE_W,
              height: STICKY_NOTE_H,
            }
          : p
      );
    }
    const next = clampFrameRect(rect, { minWidth: 280, minHeight: 200 });
    return list.map((p) =>
      p.id === id
        ? {
            ...p,
            left: next.left,
            top: next.top,
            width: next.width,
            height: next.height,
          }
        : p
    );
  });
}

/**
 * Open a note by guid in NoteDetail and select it in the list.
 * Does not alter omniText / filter mode.
 * @param {string} guid
 * @returns {Promise<object | null>}
 */
export async function selectNoteByGuid(guid) {
  if (!guid) return null;
  const database = await db();
  const note = await database.notes.findOne(guid).exec();
  if (!note) return null;
  selectedNote.set(note);
  bodyText.set(note.body ?? '');
  return note;
}

/**
 * Open a note by exact title (name), creating it if missing.
 * Does not alter omniText / filter mode.
 * @param {string} name
 * @returns {Promise<object | null>}
 */
export async function openNoteByName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  const database = await db();
  const existing = await database.notes
    .findOne({ selector: { name: trimmed } })
    .exec();
  if (existing) {
    return selectNoteByGuid(existing.guid);
  }
  const note = await database.notes.insert({
    guid: uuidv4(),
    name: trimmed,
    createdAt: new Date().getTime(),
    updatedAt: new Date().getTime(),
  });
  invalidateWikiNoteNames();
  selectedNote.set(note);
  bodyText.set('');
  return note;
}

/** @type {string[] | null} */
let wikiNoteNamesCache = null;

/** Drop cached note titles (call after create / rename / delete). */
export function invalidateWikiNoteNames() {
  wikiNoteNamesCache = null;
}

/**
 * Note titles for wiki-link autocomplete. Cached until invalidated.
 * @returns {Promise<string[]>}
 */
export async function getWikiNoteNames() {
  if (wikiNoteNamesCache) return wikiNoteNamesCache;
  const database = await db();
  const docs = await database.notes.find().exec();
  wikiNoteNamesCache = docs.map((n) => n.name).filter(Boolean);
  return wikiNoteNamesCache;
}

omniText.subscribe(v => {
  if (v === '') {
    omniMode.set('search');
    selectedNote.set('')
    // TODO: scroll to top of NoteList
  }
});

noteListHeight.subscribe(v => localStorage.setItem('noteListHeight', v.toString()));
mediaViewerHeight.subscribe((v) => localStorage.setItem('mediaViewerHeight', v.toString()));
sidebarWidth.subscribe(v => localStorage.setItem('sidebarWidth', v.toString()));
sidebarOpen.subscribe(v => localStorage.setItem('sidebarOpen', JSON.stringify(v)));
graphViewHeight.subscribe(v => localStorage.setItem('graphViewHeight', v.toString()));
graphViewZoom.subscribe(v => localStorage.setItem('graphViewZoom', v.toString()));
graphViewOpen.subscribe(v => localStorage.setItem('graphViewOpen', JSON.stringify(v)));

/** Debounced bump of the Settings note so the list timestamp reflects last preference change. */
let touchSettingsNoteTimer;
function touchSettingsNote() {
  clearTimeout(touchSettingsNoteTimer);
  touchSettingsNoteTimer = setTimeout(async () => {
    try {
      const database = await db();
      const note = await database.notes.findOne(SETTINGS_GUID).exec();
      if (!note) return;
      await note.incrementalModify((data) => {
        data.updatedAt = Date.now();
        return data;
      });
    } catch {
      // DB may still be opening, or collection reset mid-flight.
    }
  }, 300);
}

/**
 * Persist a preference to localStorage; after the initial subscribe, bump Settings `updatedAt`.
 * @param {import('svelte/store').Readable<any>} store
 * @param {string} key
 * @param {(v: any) => string} serialize
 */
function persistPreference(store, key, serialize) {
  let ready = false;
  store.subscribe((v) => {
    localStorage.setItem(key, serialize(v));
    if (!ready) {
      ready = true;
      return;
    }
    touchSettingsNote();
  });
}

persistPreference(fullScreen, 'fullScreen', (v) => JSON.stringify(v));
persistPreference(windowed, 'windowed', (v) => JSON.stringify(v));
persistPreference(showClock, 'showClock', (v) => String(v));
persistPreference(showStatusBar, 'showStatusBar', (v) => JSON.stringify(v));
persistPreference(markdownPreviewPlain, 'markdownPreviewPlain', (v) => JSON.stringify(v));
persistPreference(markdownPreviewRich, 'markdownPreviewRich', (v) => JSON.stringify(v));
persistPreference(birthDate, 'birthDate', (v) => v);
persistPreference(expectedLongevity, 'expectedLongevity', (v) => v);
persistPreference(lifeCalendarStat, 'lifeCalendarStat', (v) => v);
persistPreference(accentColor, 'accentColor', (v) => normalizeAccentColor(v));
persistPreference(lockPin, 'lockPin', (v) => (LOCK_PIN_RE.test(v) ? v : ''));
persistPreference(lockTimeoutSeconds, 'lockTimeoutSeconds', (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '0';
  const clamped = Math.min(LOCK_TIMEOUT_MAX, Math.max(0, n));
  return String(Math.round(clamped / LOCK_TIMEOUT_STEP) * LOCK_TIMEOUT_STEP);
});

appWindowFrame.subscribe((v) => {
  if (v) localStorage.setItem('appWindowFrame', JSON.stringify(v));
  else localStorage.removeItem('appWindowFrame');
});
stickyNoteFrames.subscribe((v) => {
  localStorage.setItem('stickyNoteFrames', JSON.stringify(v ?? {}));
});
