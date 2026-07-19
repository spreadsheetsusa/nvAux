<script>
  // @ts-nocheck
  import { flip } from 'svelte/animate';
  import KanbanCard from './KanbanCard.svelte';

  let {
    column,
    density = 'comfortable',
    dragOverCardId = null,
    dragOverColumn = false,
    draggingCardId = null,
    onRenameColumn,
    onDeleteColumn,
    onAddCard,
    onRenameCard,
    onDeleteCard,
    onCardPointerDown,
  } = $props();

  let editingTitle = $state(false);
  let draftTitle = $state('');

  function startRename() {
    draftTitle = column.title ?? '';
    editingTitle = true;
  }

  function commitRename() {
    if (!editingTitle) return;
    editingTitle = false;
    const next = draftTitle.trim();
    if (next && next !== column.title) onRenameColumn?.(column.id, next);
  }

  function onTitleKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      editingTitle = false;
    }
  }
</script>

<section
  class="kanban-column flex flex-col flex-shrink-0"
  class:compact={density === 'compact'}
  class:drag-over={dragOverColumn}
  data-kanban-column-id={column.id}
  aria-label={column.title}
>
  <header class="column-header flex items-center gap-1">
    {#if editingTitle}
      <input
        class="column-title-input"
        bind:value={draftTitle}
        onblur={commitRename}
        onkeydown={onTitleKeydown}
        aria-label="Column title"
      />
    {:else}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <h3 class="column-title truncate" ondblclick={startRename} title="Double-click to rename">
        {column.title}
      </h3>
    {/if}
    <span class="card-count flex-shrink-0">{column.cards.length}</span>
    <button
      type="button"
      class="col-btn"
      aria-label="Delete column"
      title="Delete column"
      onclick={() => onDeleteColumn?.(column.id)}
    >
      ×
    </button>
  </header>

  <div class="column-cards thin-scrollbar flex-1 min-h-0 overflow-y-auto" role="list">
    {#each column.cards as card (card.id)}
      <div class="card-flip" animate:flip={{ duration: 220 }}>
        <KanbanCard
          {card}
          {density}
          dragOver={dragOverCardId === card.id}
          dragging={draggingCardId === card.id}
          onRename={onRenameCard}
          onDelete={onDeleteCard}
          onPointerDown={onCardPointerDown}
        />
      </div>
    {/each}
  </div>

  <button type="button" class="add-card" onclick={() => onAddCard?.(column.id)}>
    + Card
  </button>
</section>

<style>
  .kanban-column {
    /* Size against the scroll plane, not the viewport — enables real overflow-x. */
    width: min(260px, calc(100cqw - 24px));
    max-height: 100%;
    padding: 8px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--app-notedetail-background) 70%, #000);
    border: 1px solid var(--app-statusbar-border, #2b2d30);
    scroll-snap-align: start;
    scroll-snap-stop: normal;
  }

  .kanban-column.compact {
    width: min(220px, calc(100cqw - 32px));
    padding: 6px;
  }

  .kanban-column.drag-over {
    border-color: var(--kanban-accent, var(--app-accent));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--kanban-accent, var(--app-accent)) 40%, transparent);
  }

  .column-header {
    margin-bottom: 8px;
    min-height: 32px;
  }

  .column-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    cursor: default;
  }

  .column-title-input {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--kanban-accent, var(--app-accent));
    border-radius: 4px;
    background: var(--app-omni-background);
    color: var(--text-color);
    font-size: 13px;
    font-weight: 600;
    padding: 4px 6px;
    outline: none;
  }

  .card-count {
    font-size: 11px;
    color: #7e848c;
    padding: 0 4px;
  }

  .col-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #7e848c;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0;
    flex-shrink: 0;
  }

  .col-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
  }

  .column-cards {
    min-height: 40px;
    padding-right: 2px;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    /* Allow horizontal board pan to win when gesture is mostly sideways. */
    touch-action: pan-x pan-y;
  }

  .card-flip {
    /* FLIP target wrapper — keep layout stable during animate:flip */
    will-change: transform;
  }

  .add-card {
    margin-top: 4px;
    width: 100%;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #7e848c;
    font-size: 12px;
    padding: 10px 6px;
    min-height: 40px;
    cursor: pointer;
    text-align: left;
  }

  .add-card:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--kanban-accent, var(--app-accent));
  }

  @media (max-width: 768px) {
    .column-header {
      min-height: 36px;
    }

    .col-btn {
      width: 36px;
      height: 36px;
      font-size: 18px;
    }

    .add-card {
      min-height: 44px;
      padding: 12px 8px;
      font-size: 13px;
    }
  }
</style>
