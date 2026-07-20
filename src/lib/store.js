import { writable, get } from 'svelte/store';
import { v4 as uuidv4 } from 'uuid';

import { addRxPlugin, createRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

import { schema } from './schema';

/**
 * State that persists to localStorage =========================================
 */

const storedNoteListHeightRaw = localStorage.getItem('noteListHeight');
const parsedNoteListHeight = Number(storedNoteListHeightRaw);
/**
 * True when a real preferred height is stored. Values at the clamp floor (60)
 * are treated as unset — they usually come from a layout-race clamp that was
 * incorrectly persisted, which hides the note list on later visits.
 */
export const noteListHeightHasStore =
  storedNoteListHeightRaw !== null &&
  Number.isFinite(parsedNoteListHeight) &&
  parsedNoteListHeight > 60;
const storedNoteListHeight = noteListHeightHasStore
  ? parsedNoteListHeight
  : 220;
const storedSidebarWidth = localStorage.getItem('sidebarWidth') || 443;

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
const storedBirthDate = localStorage.getItem('birthDate') || '1982-05-24';
const storedExpectedLongevity = localStorage.getItem('expectedLongevity') || '80';
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

/**
 * Svelte Writables ************************************************************
 */

export const omniMode = writable('search');
export const omniText = writable('');
export const noteList = writable([]);
export const noteListHeight = writable(Number(storedNoteListHeight));
/** Persist preferred note-list height only (not temporary layout clamps). */
export function persistNoteListHeight(height) {
  localStorage.setItem('noteListHeight', String(height));
}
export const sidebarWidth = writable(Number(storedSidebarWidth));
export const selectedNote = writable({});
export const bodyText = writable('');
export const markdownPreview = writable(false);
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

accentColor.subscribe((v) => {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--app-accent', normalizeAccentColor(v));
  }
});
/** Height of the media player bar under the Omnibar (0 when hidden). */
export const mediaPlayerHeight = writable(0);

/**
 * Session-only floating note popups (App Windowed).
 * @type {import('svelte/store').Writable<Array<{
 *   id: string,
 *   guid: string,
 *   left: number,
 *   top: number,
 *   width: number,
 *   height: number,
 *   zIndex: number,
 * }>>}
 */
export const notePopups = writable([]);

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
 * Open a floating note popup for guid (App Windowed). One per guid — reopens raise existing.
 * @param {string} guid
 */
export function openNotePopup(guid) {
  if (!guid) return;
  let raised = false;
  notePopups.update((list) => {
    const existing = list.find((p) => p.guid === guid);
    if (existing) {
      raised = true;
      const z = nextWindowZ();
      return list.map((p) =>
        p.id === existing.id ? { ...p, zIndex: z } : p
      );
    }
    const z = nextWindowZ();
    const index = list.length;
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
  notePopups.update((list) =>
    list.map((p) =>
      p.id === id
        ? {
            ...p,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }
        : p
    )
  );
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

sidebarWidth.subscribe(v => localStorage.setItem('sidebarWidth', v.toString()));
sidebarOpen.subscribe(v => localStorage.setItem('sidebarOpen', JSON.stringify(v)));

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
persistPreference(birthDate, 'birthDate', (v) => v);
persistPreference(expectedLongevity, 'expectedLongevity', (v) => v);
persistPreference(lifeCalendarStat, 'lifeCalendarStat', (v) => v);
persistPreference(accentColor, 'accentColor', (v) => normalizeAccentColor(v));
