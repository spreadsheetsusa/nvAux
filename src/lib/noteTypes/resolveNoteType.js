import { isEmptyObject } from '../../utils/isEmptyObject';
import { parseNoteMeta } from './parseNoteMeta';

/** @typedef {'empty' | 'settings' | 'kanban' | 'music' | 'markdown'} NoteType */

/** Keep local to avoid import cycles with store.js seeding. */
const SETTINGS_GUID = '00000000-0000-0000-0000-000000000000';

const KNOWN_BODY_TYPES = new Set(['kanban', 'music']);

/**
 * Rich (non-plaintext) body note types that default to Preview.
 * @param {string | null | undefined} type
 * @returns {boolean}
 */
export function isRichNoteType(type) {
  return typeof type === 'string' && KNOWN_BODY_TYPES.has(type);
}

/**
 * Resolve which UI to render for a note.
 * Order: empty → settings → body meta type → markdown.
 *
 * @param {{ guid?: string } | null | undefined} note
 * @param {string | null | undefined} body
 * @returns {NoteType}
 */
export function resolveNoteType(note, body) {
  if (!note || isEmptyObject(note)) return 'empty';
  if (note.guid === SETTINGS_GUID) return 'settings';

  const meta = parseNoteMeta(body ?? '');
  const type = meta.type?.trim().toLowerCase();
  if (type && KNOWN_BODY_TYPES.has(type)) return /** @type {NoteType} */ (type);

  return 'markdown';
}
