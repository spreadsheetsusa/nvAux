import {
  emptyKanbanBoard,
  serializeKanbanNote,
} from './kanban/kanbanModel';
import { defaultMusicBody } from './music/musicModel';

/**
 * Default body for a newly created typed note.
 * @param {'kanban' | 'music' | string} type
 * @returns {string}
 */
export function defaultBodyForType(type) {
  if (type === 'kanban') {
    return serializeKanbanNote({ density: 'comfortable' }, emptyKanbanBoard());
  }
  if (type === 'music') {
    return defaultMusicBody();
  }
  return '';
}
