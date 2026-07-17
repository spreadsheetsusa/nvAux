import { writable } from 'svelte/store';

import { addRxPlugin, createRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

import { schema } from './schema';

/**
 * State that persists to localStorage =========================================
 */

const storedNoteListHeight = localStorage.getItem('noteListHeight') || 220;
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
const storedShowClock = JSON.parse(localStorage.getItem('showClock')) || "true";
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

/**
 * RxDB ************************************************************************
 */

/** Bumped with RxDB 17 schema (indexed fields must be required). */
const DB_NAME = 'nvauxdb17';

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

  const notes = await db.notes.find().exec();

  let welcomeNote = await db.notes.findOne('11111111-1111-1111-1111-111111111111').exec();

  setTimeout(() => {
    if (notes.length === 0 && !welcomeNote) {
      db.notes.insert({
        guid: '11111111-1111-1111-1111-111111111111',
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
        updatedAt: new Date().getTime()
      });
    };
  }, 100);

  // Always make sure the Settings Note exists
  let settingsNote = await db.notes.findOne('00000000-0000-0000-0000-000000000000').exec();

  if (!settingsNote) {
    await db.notes.insert({
      guid: '00000000-0000-0000-0000-000000000000',
      name: '⚙️ nvAux Settings',
      body: 'Adjust Your nvAux Preferences',
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime()
    });
  };


  dbPromise = db;
  return db;
};

export const db = () => dbPromise ? dbPromise : _create();

/**
 * Svelte Writables ************************************************************
 */

export const omniMode = writable('search');
export const omniText = writable('');
export const noteList = writable([]);
export const noteListHeight = writable(Number(storedNoteListHeight));
export const sidebarWidth = writable(Number(storedSidebarWidth));
export const selectedNote = writable({});
export const bodyText = writable('');
export const markdownPreview = writable(false);
export const fullScreen = writable(storedFullScreen);
/** App Mode floating window (vs edge-to-edge fullscreen). */
export const windowed = writable(storedWindowed);
export const showClock = writable(storedShowClock);
export const sidebarOpen = writable(storedSidebarOpen);
export const birthDate = writable(storedBirthDate);
export const expectedLongevity = writable(storedExpectedLongevity);
export const lifeCalendarStat = writable(storedLifeCalendarStat);
export const LIFE_CALENDAR_STAT_MODES = LIFE_CALENDAR_STATS;
/** Height of the media player bar above the StatusBar (0 when hidden). */
export const mediaPlayerHeight = writable(0);

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

omniText.subscribe(v => {
  if (v === '') {
    omniMode.set('search');
    selectedNote.set('')
    // TODO: scroll to top of NoteList
  }
});

noteListHeight.subscribe(v => localStorage.setItem('noteListHeight', v.toString()));
sidebarWidth.subscribe(v => localStorage.setItem('sidebarWidth', v.toString()));

fullScreen.subscribe(v => localStorage.setItem('fullScreen', JSON.stringify(v)));
windowed.subscribe(v => localStorage.setItem('windowed', JSON.stringify(v)));
showClock.subscribe(v => localStorage.setItem('showClock', v));
sidebarOpen.subscribe(v => localStorage.setItem('sidebarOpen', JSON.stringify(v)));
birthDate.subscribe(v => localStorage.setItem('birthDate', v));
expectedLongevity.subscribe(v => localStorage.setItem('expectedLongevity', v));
lifeCalendarStat.subscribe(v => localStorage.setItem('lifeCalendarStat', v));
