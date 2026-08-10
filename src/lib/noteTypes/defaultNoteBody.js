import {
  emptyKanbanBoard,
  serializeKanbanNote,
} from './kanban/kanbanModel';
import { defaultMusicBody } from './music/musicModel';
import { defaultTimelineBody } from './timeline/timelineModel';

/**
 * Default body for a newly created typed note.
 * @param {'kanban' | 'music' | 'timeline' | string} type
 * @returns {string}
 */
export function defaultBodyForType(type) {
  if (type === 'kanban') {
    return serializeKanbanNote({ density: 'comfortable' }, emptyKanbanBoard());
  }
  if (type === 'music') {
    return defaultMusicBody();
  }
  if (type === 'timeline') {
    return defaultTimelineBody();
  }
  return '';
}
