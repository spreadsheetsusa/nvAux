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

  /** @type {{ title: string, width: number, height: number, x: number, y: number, compact: boolean } | null} */
  let dragGhost = $state(null);

  /** @type {HTMLDivElement | undefined} */
  let boardEl = $state();
  /** @type {HTMLDivElement | undefined} */
  let boardScrollEl = $state();

  const DRAG_THRESHOLD = 8;
  const EDGE_SCROLL_PX = 48;
  const EDGE_SCROLL_SPEED = 18;

  /** @type {{
   *   cardId: string,
   *   pointerId: number,
   *   startX: number,
   *   startY: number,
   *   offsetX: number,
   *   offsetY: number,
   *   active: boolean,
   *   captureEl: Element | null,
   *   originBoard: any,
   *   dirty: boolean,
   * } | null} */
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

  function findCardPlacement(b, cardId) {
    if (!b) return null;
    for (const col of b.columns) {
      const index = col.cards.findIndex((c) => c.id === cardId);
      if (index >= 0) return { columnId: col.id, index };
    }
    return null;
  }

  function findCardTitle(b, cardId) {
    if (!b) return '';
    for (const col of b.columns) {
      const card = col.cards.find((c) => c.id === cardId);
      if (card) return card.title ?? '';
    }
    return '';
  }

  function clearDrag() {
    dragCardId = null;
    dragOverCardId = null;
    dragOverColumnId = null;
    dragging = false;
    dragGhost = null;
    pointerDrag = null;
    boardEl?.classList.remove('is-dragging');
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   */
  function hitTestDropTarget(clientX, clientY) {
    const stack = document.elementsFromPoint?.(clientX, clientY) ?? [];
    let cardId = null;
    let columnId = null;
    for (const el of stack) {
      if (!(el instanceof Element)) continue;
      if (el.closest?.('.kanban-drag-ghost')) continue;
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

  /**
   * Live-move the dragged card so sibling cards FLIP into place.
   * @param {number} clientX
   * @param {number} clientY
   */
  function previewDropAt(clientX, clientY) {
    if (!board || !dragCardId || !pointerDrag?.active) return;

    const { cardId, columnId } = hitTestDropTarget(clientX, clientY);
    dragOverCardId = cardId;
    dragOverColumnId = columnId;
    if (!columnId) return;

    let toIndex;
    if (cardId) {
      const placement = findCardPlacement(board, cardId);
      if (!placement) return;
      toIndex = placement.index;
    } else {
      const col = board.columns.find((c) => c.id === columnId);
      if (!col) return;
      toIndex = col.cards.length;
    }

    const current = findCardPlacement(board, dragCardId);
    // Already at end of this column while hovering empty column body
    if (
      !cardId &&
      current &&
      current.columnId === columnId &&
      current.index === toIndex - 1
    ) {
      return;
    }
    if (current && current.columnId === columnId && current.index === toIndex) {
      return;
    }

    const next = moveCard(board, dragCardId, columnId, toIndex);
    if (next === board) return;
    const after = findCardPlacement(next, dragCardId);
    if (
      current &&
      after &&
      current.columnId === after.columnId &&
      current.index === after.index
    ) {
      return;
    }
    board = next;
    pointerDrag.dirty = true;
  }

  /**
   * Auto-scroll the board plane when the pointer nears an edge.
   * @param {number} clientX
   * @param {number} clientY
   */
  function maybeEdgeScroll(clientX, clientY) {
    const scroller = boardScrollEl;
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    if (clientX < rect.left + EDGE_SCROLL_PX) {
      scroller.scrollLeft -= EDGE_SCROLL_SPEED;
    } else if (clientX > rect.right - EDGE_SCROLL_PX) {
      scroller.scrollLeft += EDGE_SCROLL_SPEED;
    }

    // Vertical scroll inside the column under the pointer
    const stack = document.elementsFromPoint?.(clientX, clientY) ?? [];
    for (const el of stack) {
      if (!(el instanceof Element)) continue;
      const cards = el.closest?.('.column-cards');
      if (!(cards instanceof HTMLElement)) continue;
      const cRect = cards.getBoundingClientRect();
      if (clientY < cRect.top + EDGE_SCROLL_PX) {
        cards.scrollTop -= EDGE_SCROLL_SPEED;
      } else if (clientY > cRect.bottom - EDGE_SCROLL_PX) {
        cards.scrollTop += EDGE_SCROLL_SPEED;
      }
      break;
    }
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
    const rect = captureEl?.getBoundingClientRect?.();
    pointerDrag = {
      cardId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: rect ? e.clientX - rect.left : 12,
      offsetY: rect ? e.clientY - rect.top : 12,
      active: false,
      captureEl,
      originBoard: board,
      dirty: false,
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
        const r = pointerDrag.captureEl?.getBoundingClientRect?.();
        dragGhost = {
          title: findCardTitle(board, pointerDrag.cardId),
          width: r?.width ?? 200,
          height: r?.height ?? 40,
          x: ev.clientX - pointerDrag.offsetX,
          y: ev.clientY - pointerDrag.offsetY,
          compact: density === 'compact',
        };
        try {
          pointerDrag.captureEl?.setPointerCapture?.(ev.pointerId);
        } catch {
          /* ignore */
        }
      }
      ev.preventDefault();
      if (dragGhost) {
        dragGhost = {
          ...dragGhost,
          x: ev.clientX - pointerDrag.offsetX,
          y: ev.clientY - pointerDrag.offsetY,
        };
      }
      maybeEdgeScroll(ev.clientX, ev.clientY);
      previewDropAt(ev.clientX, ev.clientY);
    };

    const onUp = (ev) => {
      if (!pointerDrag || ev.pointerId !== pointerDrag.pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);

      const wasActive = pointerDrag.active;
      const dirty = pointerDrag.dirty;
      const origin = pointerDrag.originBoard;
      const cancelled = ev.type === 'pointercancel';
      clearDrag();

      if (!wasActive || !board) return;

      if (cancelled) {
        if (origin) board = origin;
        return;
      }

      if (dirty) {
        emit(theme, board);
      } else if (origin && origin !== board) {
        board = origin;
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
    <div
      class="board-scroll thin-scrollbar flex-1 min-h-0"
      bind:this={boardScrollEl}
    >
      <div class="board-row flex items-stretch gap-2 h-full">
        {#each board.columns as column (column.id)}
          <KanbanColumn
            {column}
            {density}
            dragOverCardId={dragOverCardId}
            dragOverColumn={dragOverColumnId === column.id}
            draggingCardId={dragging ? dragCardId : null}
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

  {#if dragGhost}
    <div
      class="kanban-drag-ghost"
      class:compact={dragGhost.compact}
      style="width: {dragGhost.width}px; min-height: {dragGhost.height}px; transform: translate3d({dragGhost.x}px, {dragGhost.y}px, 0);"
      aria-hidden="true"
    >
      {dragGhost.title}
    </div>
  {/if}
</div>

<style>
  .kanban-board {
    margin-top: 4px;
    position: relative;
    /* Bound width so the plane can scroll instead of growing the flex parent. */
    min-width: 0;
    width: 100%;
  }

  .kanban-board.is-dragging {
    touch-action: none;
    user-select: none;
    cursor: grabbing;
  }

  .parse-error {
    padding: 6px 10px;
    font-size: 12px;
    color: #f0a0a0;
    background: rgba(180, 40, 40, 0.15);
  }

  .board-scroll {
    min-width: 0;
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 8px;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    touch-action: pan-x pan-y;
    container-type: inline-size;
    container-name: kanban-plane;
  }

  .board-row {
    min-height: 100%;
    align-items: stretch;
    width: max-content;
    min-width: 100%;
  }

  .add-column {
    align-self: flex-start;
    width: min(140px, calc(100cqw - 24px));
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

  .kanban-drag-ghost {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 2000;
    pointer-events: none;
    box-sizing: border-box;
    display: flex;
    align-items: flex-start;
    padding: 10px 12px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--kanban-accent, var(--app-accent)) 14%, var(--app-omni-background));
    border: 1px solid color-mix(in srgb, var(--kanban-accent, var(--app-accent)) 40%, transparent);
    color: var(--text-color, rgba(255, 255, 255, 0.9));
    font-size: 13px;
    line-height: 1.35;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
    overflow-wrap: anywhere;
    word-break: break-word;
    opacity: 0.96;
    will-change: transform;
  }

  .kanban-drag-ghost.compact {
    padding: 7px 8px;
    font-size: 12px;
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
