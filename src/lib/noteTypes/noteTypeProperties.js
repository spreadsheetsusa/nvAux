import KanbanProperties from './kanban/KanbanProperties.svelte';
import MusicProperties from './music/MusicProperties.svelte';

/** @type {Record<string, import('svelte').Component>} */
export const NOTE_TYPE_PROPERTIES = {
  kanban: KanbanProperties,
  music: MusicProperties,
};

/**
 * Opt-in properties UI for a note type (toolbar ellipsis).
 * @param {string} noteType
 * @returns {import('svelte').Component | null}
 */
export function getNoteTypeProperties(noteType) {
  return NOTE_TYPE_PROPERTIES[noteType] ?? null;
}
