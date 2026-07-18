<script>
  // @ts-nocheck
  import {
    parseKanbanNote,
    serializeKanbanNote,
    createColumn,
    createCard,
    moveCard,
  } from './kanbanModel';
  import KanbanColumn from './KanbanColumn.svelte';
  import KanbanThemeBar from './KanbanThemeBar.svelte';

  let {
    body = '',
    onChange,
  } = $props();

  let board = $state.raw(null);
  let theme = $state.raw({ density: 'comfortable' });
  let parseError = $state(null);
  let lastBody = $state('');

  // Sync from note body when external edits land (Edit mode / other windows).
  $effect(() => {
    const nextBody = body ?? '';
    if (nextBody === lastBody && board) return;
    lastBody = nextBody;
    const result = parseKanbanNote(nextBody);
    board = result.board;
    theme = result.theme;
    parseError = result.parseError;
  });

  let density = $derived(theme?.density === 'compact' ? 'compact' : 'comfortable');
  let accentStyle = $derived(
    theme?.accent ? `--kanban-accent: ${theme.accent}` : undefined
  );

  let dragCardId = $state(null);
  let dragOverCardId = $state(null);
  let dragOverColumnId = $state(null);

  function emit(nextTheme, nextBoard) {
    const serialized = serializeKanbanNote(nextTheme, nextBoard);
    lastBody = serialized;
    board = nextBoard;
    theme = nextTheme;
    parseError = null;
    onChange?.(serialized);
  }

  function updateBoard(mutator) {
    if (!board) return;
    const next = mutator(board);
    if (next !== board) emit(theme, next);
  }

  function onThemeChange(nextTheme) {
    if (!board) return;
    emit(nextTheme, board);
  }

  function renameColumn(columnId, title) {
    updateBoard((b) => ({
      columns: b.columns.map((c) => (c.id === columnId ? { ...c, title } : c)),
    }));
  }

  function deleteColumn(columnId) {
    updateBoard((b) => {
      if (b.columns.length <= 1) return b;
      return { columns: b.columns.filter((c) => c.id !== columnId) };
    });
  }

  function addColumn() {
    updateBoard((b) => ({ columns: [...b.columns, createColumn()] }));
  }

  function addCard(columnId) {
    updateBoard((b) => ({
      columns: b.columns.map((c) =>
        c.id === columnId ? { ...c, cards: [...c.cards, createCard()] } : c
      ),
    }));
  }

  function renameCard(cardId, title) {
    updateBoard((b) => ({
      columns: b.columns.map((col) => ({
        ...col,
        cards: col.cards.map((card) =>
          card.id === cardId ? { ...card, title } : card
        ),
      })),
    }));
  }

  function deleteCard(cardId) {
    updateBoard((b) => ({
      columns: b.columns.map((col) => ({
        ...col,
        cards: col.cards.filter((card) => card.id !== cardId),
      })),
    }));
  }

  function onCardDragStart(cardId, e) {
    dragCardId = cardId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cardId);
  }

  function onCardDragOver(cardId, e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverCardId = cardId;
    const col = board?.columns.find((c) => c.cards.some((k) => k.id === cardId));
    dragOverColumnId = col?.id ?? null;
  }

  function onColumnDragOver(columnId, e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverColumnId = columnId;
    dragOverCardId = null;
  }

  function dropOnCard(targetCardId, e) {
    e.preventDefault();
    e.stopPropagation();
    const cardId = dragCardId || e.dataTransfer.getData('text/plain');
    clearDrag();
    if (!cardId || !board || cardId === targetCardId) return;

    let toColumnId = null;
    let toIndex = 0;
    for (const col of board.columns) {
      const idx = col.cards.findIndex((c) => c.id === targetCardId);
      if (idx >= 0) {
        toColumnId = col.id;
        toIndex = idx;
        break;
      }
    }
    if (!toColumnId) return;
    emit(theme, moveCard(board, cardId, toColumnId, toIndex));
  }

  function dropOnColumn(columnId, e) {
    e.preventDefault();
    const cardId = dragCardId || e.dataTransfer.getData('text/plain');
    clearDrag();
    if (!cardId || !board) return;
    const col = board.columns.find((c) => c.id === columnId);
    if (!col) return;
    // If dropped on a card inside, card handler already ran.
    if (e.target?.closest?.('.kanban-card')) return;
    emit(theme, moveCard(board, cardId, columnId, col.cards.length));
  }

  function clearDrag() {
    dragCardId = null;
    dragOverCardId = null;
    dragOverColumnId = null;
  }
</script>

<div class="kanban-board flex flex-col flex-1 min-h-0 overflow-hidden" style={accentStyle}>
  <KanbanThemeBar {theme} onChange={onThemeChange} />

  {#if parseError}
    <div class="parse-error flex-shrink-0">
      Invalid kanban JSON — switch to Edit and fix the source. ({parseError})
    </div>
  {/if}

  {#if board}
    <div class="board-scroll thin-scrollbar flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
      <div class="board-row flex items-stretch gap-2 h-full">
        {#each board.columns as column (column.id)}
          <KanbanColumn
            {column}
            {density}
            dragOverCardId={dragOverCardId}
            dragOverColumn={dragOverColumnId === column.id}
            onRenameColumn={renameColumn}
            onDeleteColumn={deleteColumn}
            onAddCard={addCard}
            onRenameCard={renameCard}
            onDeleteCard={deleteCard}
            onCardDragStart={onCardDragStart}
            onCardDragOver={onCardDragOver}
            onCardDrop={dropOnCard}
            onCardDragEnd={clearDrag}
            onColumnDragOver={onColumnDragOver}
            onColumnDrop={dropOnColumn}
          />
        {/each}
        <button type="button" class="add-column flex-shrink-0" onclick={addColumn}>
          + Column
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .kanban-board {
    margin-top: 4px;
  }

  .parse-error {
    padding: 6px 10px;
    font-size: 12px;
    color: #f0a0a0;
    background: rgba(180, 40, 40, 0.15);
  }

  .board-scroll {
    padding: 8px;
  }

  .board-row {
    min-height: 100%;
    align-items: stretch;
  }

  .add-column {
    align-self: flex-start;
    width: 140px;
    height: 36px;
    border: 1px dashed var(--app-statusbar-border, #2b2d30);
    border-radius: 8px;
    background: transparent;
    color: #7e848c;
    font-size: 12px;
    cursor: pointer;
  }

  .add-column:hover {
    border-color: var(--kanban-accent, var(--app-accent));
    color: var(--kanban-accent, var(--app-accent));
  }
</style>
