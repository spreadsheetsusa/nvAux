import { addRxPlugin, createRxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { wrappedKeyEncryptionCryptoJsStorage } from 'rxdb/plugins/encryption-crypto-js';

import { schema } from './schema';
import {
  getDbPasswordFingerprint,
  getOrCreateDbPassword,
  legacyIndexedDbExists,
  replaceDbPassword,
} from './dbEncryption';
import { defaultKanbanBody } from './noteTypes/kanban/kanbanModel';
import { defaultMusicBody } from './noteTypes/music/musicModel';

/**
 * RxDB ************************************************************************
 */

/** Encrypted-at-rest DB (RxDB encryption-crypto-js + Dexie). */
const DB_NAME = 'nvauxdb18';
/** Pre-encryption DB — one-time migrated into nvauxdb18 when present. */
const LEGACY_DB_NAME = 'nvauxdb17';

/** sessionStorage key for durable mid-regen note snapshots. */
const RESTORE_STAGING_KEY = 'nvauxPendingRestoreNotes';

/** Seeded Settings note — also the target for preference `updatedAt` bumps. */
export const SETTINGS_GUID = '00000000-0000-0000-0000-000000000000';

const WELCOME_GUID = '11111111-1111-1111-1111-111111111111';
const TECHNO_LEAGUE_GUID = '22222222-2222-2222-2222-222222222222';
const KANBAN_DEMO_GUID = '33333333-3333-3333-3333-333333333333';
const VIDEO_DEMO_GUID = '44444444-4444-4444-4444-444444444444';
const MUSIC_DEMO_GUID = '55555555-5555-5555-5555-555555555555';

let dbPromise;

/**
 * @typedef {{ guid: string, name: string, body: string, createdAt: number, updatedAt: number }} NoteSnapshot
 */

/** @type {NoteSnapshot[] | null} */
let pendingRestoreNotes = null;

/** @param {string} name */
function deleteIndexedDb(name) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Wipe RxDB/Dexie IndexedDB files for a logical database name (no open required). */
async function deleteIndexedDatabasesFor(databaseName) {
  if (typeof indexedDB === 'undefined') return;
  const prefix = `rxdb-dexie-${databaseName}--`;
  if (typeof indexedDB.databases === 'function') {
    try {
      const dbs = await indexedDB.databases();
      await Promise.all(
        dbs
          .filter((d) => typeof d.name === 'string' && d.name.startsWith(prefix))
          .map((d) => deleteIndexedDb(/** @type {string} */ (d.name)))
      );
      return;
    } catch {
      /* fall through */
    }
  }
  await Promise.all([
    deleteIndexedDb(`${prefix}0--_rxdb_0`),
    deleteIndexedDb(`${prefix}0--_rxdb_internal`),
  ]);
}

/** @param {NoteSnapshot[]} notes */
function stageRestoreNotes(notes) {
  pendingRestoreNotes = notes;
  try {
    sessionStorage.setItem(RESTORE_STAGING_KEY, JSON.stringify(notes));
  } catch {
    /* quota / private mode — in-memory still used for same-tab regen */
  }
}

/** @returns {NoteSnapshot[] | null} */
function loadStagedRestoreNotes() {
  if (pendingRestoreNotes?.length) return pendingRestoreNotes;
  try {
    const raw = sessionStorage.getItem(RESTORE_STAGING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    pendingRestoreNotes = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function clearRestoreStaging() {
  pendingRestoreNotes = null;
  try {
    sessionStorage.removeItem(RESTORE_STAGING_KEY);
  } catch {
    /* ignore */
  }
}

/** Plaintext schema for reading legacy unencrypted DBs (no `encrypted` fields). */
function plaintextNoteSchema() {
  const { encrypted: _enc, ...rest } = schema;
  return rest;
}

/**
 * @param {import('rxdb').RxDatabase} encryptedDb
 */
async function migrateFromLegacyIfNeeded(encryptedDb) {
  const existing = await encryptedDb.notes.find().exec();
  if (existing.length > 0) return;

  const hasLegacy = await legacyIndexedDbExists(LEGACY_DB_NAME);
  // false = confidently absent; null = unknown (try open); true = present
  if (hasLegacy === false) return;

  let legacy;
  try {
    legacy = await createRxDatabase({
      name: LEGACY_DB_NAME,
      storage: getRxStorageDexie(),
      ignoreDuplicate: true,
    });
    await legacy.addCollections({
      notes: { schema: plaintextNoteSchema() },
    });
  } catch {
    return;
  }

  try {
    const docs = await legacy.notes.find().exec();
    for (const doc of docs) {
      const j = doc.toJSON();
      await encryptedDb.notes.insert({
        guid: j.guid,
        name: j.name,
        body: j.body ?? '',
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
      });
    }
  } finally {
    try {
      await legacy.remove();
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {import('rxdb').RxDatabase} database
 */
async function seedDefaultNotes(database) {
  const welcomeNote = await database.notes.findOne(WELCOME_GUID).exec();
  if (!welcomeNote) {
    await database.notes.insert({
      guid: WELCOME_GUID,
      name: '🚀 Welcome to nvAux!',
      body: `Welcome and thank you for using nvAux!

This is a web-based note-taking app inspired by nvALT where searching and creating notes is one in the same action. A few things to keep in-mind:

* All your notes are stored within your browser, locally. Note titles and bodies are encrypted at rest in IndexedDB (the decryption key stays on this device so the app opens without a password).
* 'Add to Home Screen' on iOS Safari for a native app-like experience.
* Notes can be typed: open **📋 Sample Kanban** for a board, or **🥁 Sample Drum Machine** for a step sequencer (Preview = UI, Edit = source). SoundCloud, YouTube, and image/video links queue into the media player — try **🎧 The Gentleman's Techno League - EP1** and **🎥 Video Link Example**.

If you are interested in the development of nvAux the project is open-source and available on GitHub at https://github.com/matterofabstract/nvaux

You can download your notes at any time by clicking the 'Download Notes' button in the nvAux settings screen.

Don't forget to follow the project on 𝕏 at @nvAuxApp and let us know what you think!
  `,
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
    });
  }

  const settingsNote = await database.notes.findOne(SETTINGS_GUID).exec();
  if (!settingsNote) {
    await database.notes.insert({
      guid: SETTINGS_GUID,
      name: '⚙️ nvAux Settings',
      body: 'Adjust Your nvAux Preferences',
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
    });
  }

  const technoLeagueNote = await database.notes.findOne(TECHNO_LEAGUE_GUID).exec();
  if (!technoLeagueNote) {
    await database.notes.insert({
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

  const kanbanDemoNote = await database.notes.findOne(KANBAN_DEMO_GUID).exec();
  if (!kanbanDemoNote) {
    await database.notes.insert({
      guid: KANBAN_DEMO_GUID,
      name: '📋 Sample Kanban',
      body: defaultKanbanBody(),
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
    });
  }

  const videoDemoNote = await database.notes.findOne(VIDEO_DEMO_GUID).exec();
  if (!videoDemoNote) {
    await database.notes.insert({
      guid: VIDEO_DEMO_GUID,
      name: '🎥 Video Link Example',
      body: `Notes that contains links to video media are playable in nvAux. Click Play Now just above.

https://www.youtube.com/watch?v=Hm3JodBR-vs
`,
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
    });
  }

  const musicDemoNote = await database.notes.findOne(MUSIC_DEMO_GUID).exec();
  if (!musicDemoNote) {
    await database.notes.insert({
      guid: MUSIC_DEMO_GUID,
      name: '🥁 Sample Drum Machine',
      body: defaultMusicBody(),
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
    });
  }
}

const _create = async () => {
  const isDev = import.meta.env.DEV;

  if (isDev) {
    const { RxDBDevModePlugin } = await import('rxdb/plugins/dev-mode');
    addRxPlugin(RxDBDevModePlugin);
  }

  const password = getOrCreateDbPassword();
  const encryptedStorage = wrappedKeyEncryptionCryptoJsStorage({
    storage: getRxStorageDexie(),
  });
  const storage = isDev
    ? (await import('rxdb/plugins/validate-ajv')).wrappedValidateAjvStorage({
        storage: encryptedStorage,
      })
    : encryptedStorage;

  const database = await createRxDatabase({
    name: DB_NAME,
    storage,
    password,
    ignoreDuplicate: isDev,
  });

  await database.addCollections({ notes: { schema } });

  const staged = loadStagedRestoreNotes();
  if (staged?.length) {
    try {
      for (const note of staged) {
        const existing = await database.notes.findOne(note.guid).exec();
        if (!existing) {
          await database.notes.insert(note);
        }
      }
      clearRestoreStaging();
    } catch (err) {
      // Keep staging so a reload can finish restore.
      throw err;
    }
  } else {
    await migrateFromLegacyIfNeeded(database);
  }

  await seedDefaultNotes(database);

  return database;
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

/**
 * Wipe IndexedDB + prefs so the next open re-seeds the default notes.
 * Works even when `db()` cannot open (wrong/missing key, corrupt storage).
 */
export async function resetDatabase() {
  clearRestoreStaging();
  const openPromise = dbPromise;
  dbPromise = undefined;
  if (openPromise) {
    try {
      const database = await openPromise;
      await database.remove();
    } catch {
      /* open/decrypt failed — fall through to force-delete */
    }
  }
  await deleteIndexedDatabasesFor(DB_NAME);
  await deleteIndexedDatabasesFor(LEGACY_DB_NAME);
  localStorage.clear();
  invalidateWikiNoteNames();
}

/**
 * Re-encrypt all notes under a new on-device key (RxDB passwords are immutable per DB).
 * Snapshots notes to sessionStorage before remove so a mid-flight reload can restore.
 * @returns {Promise<string>} new key fingerprint
 */
export async function regenerateEncryptionKey() {
  const database = await db();
  const docs = await database.notes.find().exec();
  /** @type {NoteSnapshot[]} */
  const notes = docs.map((doc) => {
    const j = doc.toJSON();
    return {
      guid: j.guid,
      name: j.name,
      body: j.body ?? '',
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
    };
  });
  stageRestoreNotes(notes);
  await database.remove();
  dbPromise = undefined;
  replaceDbPassword();
  await db();
  invalidateWikiNoteNames();
  return getDbPasswordFingerprint();
}

export { getDbPasswordFingerprint };

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

