import { writable } from 'svelte/store';

import { addRxPlugin, createRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

import { schema } from './schema';

/**
 * State that persists to localStorage =========================================
 */

const storedNoteListHeight = localStorage.getItem('noteListHeight') || 220;
const storedSidebarWidth = localStorage.getItem('sidebarWidth') || 443;
const storedFullScreen = JSON.parse(localStorage.getItem('fullScreen')) || false;
const storedMaximumFullScreen = JSON.parse(localStorage.getItem('maximumFullScreen')) || true;
const storedShowClock = JSON.parse(localStorage.getItem('showClock')) || "true";
const storedSidebarOpen = JSON.parse(localStorage.getItem('sidebarOpen')) || false;
const storedBirthDate = localStorage.getItem('birthDate') || '1982-05-24';
const storedExpectedLongevity = localStorage.getItem('expectedLongevity') || '80';
const LIFE_CALENDAR_STATS = ['percentLived', 'yearsLived', 'percentRemaining', 'yearsRemaining'];
const storedLifeCalendarStat = LIFE_CALENDAR_STATS.includes(localStorage.getItem('lifeCalendarStat'))
  ? localStorage.getItem('lifeCalendarStat')
  : 'percentLived';

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
export const maximumFullScreen = writable(storedMaximumFullScreen);
export const showClock = writable(storedShowClock);
export const sidebarOpen = writable(storedSidebarOpen);
export const birthDate = writable(storedBirthDate);
export const expectedLongevity = writable(storedExpectedLongevity);
export const lifeCalendarStat = writable(storedLifeCalendarStat);
export const LIFE_CALENDAR_STAT_MODES = LIFE_CALENDAR_STATS;

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

fullScreen.subscribe(v => localStorage.setItem('fullScreen', v));
maximumFullScreen.subscribe(v => localStorage.setItem('maximumFullScreen', v));
showClock.subscribe(v => localStorage.setItem('showClock', v));
sidebarOpen.subscribe(v => localStorage.setItem('sidebarOpen', v));
birthDate.subscribe(v => localStorage.setItem('birthDate', v));
expectedLongevity.subscribe(v => localStorage.setItem('expectedLongevity', v));
lifeCalendarStat.subscribe(v => localStorage.setItem('lifeCalendarStat', v));
