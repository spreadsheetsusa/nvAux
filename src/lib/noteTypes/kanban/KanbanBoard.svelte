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
  import KanbanThemeMenu from './KanbanThemeMenu.svelte';

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
  let dragging = $state(false);

  /** @type {HTMLDivElement | undefined} */
  let boardEl = $state();

  const DRAG_THRESHOLD = 8;
  /** @type {{ cardId: string, pointerId: number, startX: number, startY: number, active: boolean, captureEl: Element | null } | null} */
  let pointerDrag = null;

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

  function clearDrag() {
    dragCardId = null;
    dragOverCardId = null;
    dragOverColumnId = null;
    dragging = false;
    pointerDrag = null;
    boardEl?.classList.remove('is-dragging');
  }

  /**
   * Resolve drop target under pointer.
   * @param {number} clientX
   * @param {number} clientY
   */
  function hitTestDropTarget(clientX, clientY) {
    const stack = document.elementsFromPoint?.(clientX, clientY) ?? [];
    let cardId = null;
    let columnId = null;
    for (const el of stack) {
      if (!(el instanceof Element)) continue;
      if (!cardId) {
        const card = el.closest?.('[data-kanban-card-id]');
        const id = card?.getAttribute?.('data-kanban-card-id');
        if (id && id !== dragCardId) cardId = id;
      }
      if (!columnId) {
        const col = el.closest?.('[data-kanban-column-id]');
        const id = col?.getAttribute?.('data-kanban-column-id');
        if (id) columnId = id;
      }
      if (cardId && columnId) break;
    }
    return { cardId, columnId };
  }

  function updateDragOver(clientX, clientY) {
    const { cardId, columnId } = hitTestDropTarget(clientX, clientY);
    dragOverCardId = cardId;
    dragOverColumnId = columnId;
  }

  /**
   * @param {string} cardId
   * @param {PointerEvent} e
   */
  function onCardPointerDown(cardId, e) {
    if (e.button !== 0) return;
    const target = /** @type {Element | null} */ (e.target);
    if (target?.closest?.('button, input, a, textarea')) return;

    const captureEl = target?.closest?.('[data-kanban-card-id]') ?? null;
    pointerDrag = {
      cardId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      captureEl,
    };
    dragCardId = cardId;

    const onMove = (ev) => {
      if (!pointerDrag || ev.pointerId !== pointerDrag.pointerId) return;
      const dx = ev.clientX - pointerDrag.startX;
      const dy = ev.clientY - pointerDrag.startY;
      if (!pointerDrag.active) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        pointerDrag.active = true;
        dragging = true;
        boardEl?.classList.add('is-dragging');
        try {
          pointerDrag.captureEl?.setPointerCapture?.(ev.pointerId);
        } catch {
          /* ignore */
        }
      }
      ev.preventDefault();
      updateDragOver(ev.clientX, ev.clientY);
    };

    const onUp = (ev) => {
      if (!pointerDrag || ev.pointerId !== pointerDrag.pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);

      const wasActive = pointerDrag.active;
      const movingId = pointerDrag.cardId;
      const overCard = dragOverCardId;
      const overCol = dragOverColumnId;
      clearDrag();

      if (!wasActive || !board || !movingId) return;

      if (overCard && overCard !== movingId) {
        let toColumnId = null;
        let toIndex = 0;
        for (const col of board.columns) {
          const idx = col.cards.findIndex((c) => c.id === overCard);
          if (idx >= 0) {
            toColumnId = col.id;
            toIndex = idx;
            break;
          }
        }
        if (toColumnId) emit(theme, moveCard(board, movingId, toColumnId, toIndex));
        return;
      }

      if (overCol) {
        const col = board.columns.find((c) => c.id === overCol);
        if (col) emit(theme, moveCard(board, movingId, overCol, col.cards.length));
      }
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }
</script>

<div
  class="kanban-board flex flex-col flex-1 min-h-0 overflow-hidden"
  class:is-dragging={dragging}
  style={accentStyle}
  bind:this={boardEl}
>
  <KanbanThemeMenu {theme} onChange={onThemeChange} />

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
            draggingCardId={dragCardId}
            onRenameColumn={renameColumn}
            onDeleteColumn={deleteColumn}
            onAddCard={addCard}
            onRenameCard={renameCard}
            onDeleteCard={deleteCard}
            onCardPointerDown={onCardPointerDown}
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
    position: relative;
  }

  .kanban-board.is-dragging {
    touch-action: none;
    user-select: none;
  }

  .parse-error {
    padding: 6px 10px;
    font-size: 12px;
    color: #f0a0a0;
    background: rgba(180, 40, 40, 0.15);
  }

  .board-scroll {
    padding: 8px;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
  }

  .board-row {
    min-height: 100%;
    align-items: stretch;
    width: max-content;
    min-width: 100%;
  }

  .add-column {
    align-self: flex-start;
    width: min(140px, calc(100vw - 48px));
    min-height: 40px;
    height: 40px;
    scroll-snap-align: start;
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

  @media (max-width: 768px) {
    .board-scroll {
      padding: 8px 10px 12px;
    }

    .add-column {
      min-height: 44px;
      height: 44px;
      font-size: 13px;
    }
  }
</style>
