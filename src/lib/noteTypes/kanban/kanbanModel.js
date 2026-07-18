import { v4 as uuidv4 } from 'uuid';

import { parseNoteMeta, serializeNoteMeta } from '../parseNoteMeta';

/**
 * @typedef {{ id: string, title: string, body?: string }} KanbanCard
 * @typedef {{ id: string, title: string, cards: KanbanCard[] }} KanbanColumn
 * @typedef {{ columns: KanbanColumn[] }} KanbanBoardData
 * @typedef {{ accent?: string, density?: 'comfortable' | 'compact' }} KanbanTheme
 */

/** @returns {KanbanBoardData} */
export function emptyKanbanBoard() {
  return {
    columns: [
      { id: newId('col'), title: 'Todo', cards: [] },
      { id: newId('col'), title: 'Doing', cards: [] },
      { id: newId('col'), title: 'Done', cards: [] },
    ],
  };
}

/** @returns {string} */
export function defaultKanbanBody() {
  const board = emptyKanbanBoard();
  board.columns[0].cards.push({
    id: newId('card'),
    title: 'Drag me to another column',
    body: '',
  });
  board.columns[0].cards.push({
    id: newId('card'),
    title: 'Double-click a title to rename',
    body: '',
  });
  board.columns[1].cards.push({
    id: newId('card'),
    title: 'Add columns with + Column',
    body: '',
  });
  return serializeKanbanNote(
    { accent: '', density: 'comfortable' },
    board
  );
}

/** @param {string} [prefix] */
function newId(prefix = 'id') {
  return `${prefix}_${uuidv4().slice(0, 8)}`;
}

/**
 * @param {string | null | undefined} body
 * @returns {{ theme: KanbanTheme, board: KanbanBoardData, parseError: string | null }}
 */
export function parseKanbanNote(body) {
  const meta = parseNoteMeta(body ?? '');
  /** @type {KanbanTheme} */
  const theme = {
    density: meta.theme?.density === 'compact' ? 'compact' : 'comfortable',
  };
  if (meta.theme?.accent) theme.accent = meta.theme.accent;

  const raw = (meta.bodyWithoutMeta || '').trim();
  if (!raw) {
    return { theme, board: emptyKanbanBoard(), parseError: null };
  }

  try {
    const parsed = JSON.parse(raw);
    return { theme, board: normalizeBoard(parsed), parseError: null };
  } catch (err) {
    return {
      theme,
      board: emptyKanbanBoard(),
      parseError: err instanceof Error ? err.message : 'Invalid kanban JSON',
    };
  }
}

/**
 * @param {KanbanTheme} theme
 * @param {KanbanBoardData} board
 * @returns {string}
 */
export function serializeKanbanNote(theme, board) {
  const json = JSON.stringify(board, null, 2);
  /** @type {{ type: string, theme?: KanbanTheme }} */
  const meta = { type: 'kanban' };
  const themeOut = {};
  if (theme?.accent) themeOut.accent = theme.accent;
  if (theme?.density) themeOut.density = theme.density;
  if (Object.keys(themeOut).length) meta.theme = themeOut;
  return serializeNoteMeta(meta, json);
}

/**
 * @param {unknown} raw
 * @returns {KanbanBoardData}
 */
function normalizeBoard(raw) {
  if (!raw || typeof raw !== 'object') return emptyKanbanBoard();
  const columnsIn = /** @type {{ columns?: unknown }} */ (raw).columns;
  if (!Array.isArray(columnsIn) || columnsIn.length === 0) {
    return emptyKanbanBoard();
  }

  const columns = columnsIn.map((col) => {
    const c = col && typeof col === 'object' ? col : {};
    const cardsIn = Array.isArray(c.cards) ? c.cards : [];
    return {
      id: typeof c.id === 'string' && c.id ? c.id : newId('col'),
      title: typeof c.title === 'string' ? c.title : 'Column',
      cards: cardsIn.map((card) => {
        const k = card && typeof card === 'object' ? card : {};
        return {
          id: typeof k.id === 'string' && k.id ? k.id : newId('card'),
          title: typeof k.title === 'string' ? k.title : 'Card',
          body: typeof k.body === 'string' ? k.body : '',
        };
      }),
    };
  });

  return { columns };
}

/** @returns {KanbanColumn} */
export function createColumn(title = 'New column') {
  return { id: newId('col'), title, cards: [] };
}

/** @returns {KanbanCard} */
export function createCard(title = 'New card') {
  return { id: newId('card'), title, body: '' };
}

/**
 * Move a card within / across columns (immutable).
 * @param {KanbanBoardData} board
 * @param {string} cardId
 * @param {string} toColumnId
 * @param {number} toIndex
 * @returns {KanbanBoardData}
 */
export function moveCard(board, cardId, toColumnId, toIndex) {
  /** @type {KanbanCard | null} */
  let moving = null;
  const columns = board.columns.map((col) => {
    const idx = col.cards.findIndex((c) => c.id === cardId);
    if (idx < 0) return col;
    moving = col.cards[idx];
    return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
  });

  if (!moving) return board;

  return {
    columns: columns.map((col) => {
      if (col.id !== toColumnId) return col;
      const cards = [...col.cards];
      const insertAt = Math.max(0, Math.min(toIndex, cards.length));
      cards.splice(insertAt, 0, moving);
      return { ...col, cards };
    }),
  };
}
