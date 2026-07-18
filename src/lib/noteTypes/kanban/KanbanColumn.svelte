<script>
  // @ts-nocheck
  import { flip } from 'svelte/animate';
  import KanbanCard from './KanbanCard.svelte';

  let {
    column,
    density = 'comfortable',
    dragOverCardId = null,
    dragOverColumn = false,
    onRenameColumn,
    onDeleteColumn,
    onAddCard,
    onRenameCard,
    onDeleteCard,
    onCardDragStart,
    onCardDragOver,
    onCardDrop,
    onCardDragEnd,
    onColumnDragOver,
    onColumnDrop,
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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<section
  class="kanban-column flex flex-col flex-shrink-0"
  class:compact={density === 'compact'}
  class:drag-over={dragOverColumn}
  aria-label={column.title}
  ondragover={(e) => onColumnDragOver?.(column.id, e)}
  ondrop={(e) => onColumnDrop?.(column.id, e)}
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
      <div class="card-flip" animate:flip={{ duration: 180 }}>
        <KanbanCard
          {card}
          {density}
          dragOver={dragOverCardId === card.id}
          onRename={onRenameCard}
          onDelete={onDeleteCard}
          onDragStart={onCardDragStart}
          onDragOver={onCardDragOver}
          onDrop={onCardDrop}
          onDragEnd={onCardDragEnd}
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
    width: 260px;
    max-height: 100%;
    padding: 8px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--app-notedetail-background) 70%, #000);
    border: 1px solid var(--app-statusbar-border, #2b2d30);
  }

  .kanban-column.compact {
    width: 220px;
    padding: 6px;
  }

  .kanban-column.drag-over {
    border-color: var(--kanban-accent, var(--app-accent));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--kanban-accent, var(--app-accent)) 40%, transparent);
  }

  .column-header {
    margin-bottom: 8px;
    min-height: 28px;
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
    padding: 2px 6px;
    outline: none;
  }

  .card-count {
    font-size: 11px;
    color: #7e848c;
    padding: 0 4px;
  }

  .col-btn {
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #7e848c;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0;
  }

  .col-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
  }

  .column-cards {
    min-height: 40px;
    padding-right: 2px;
  }

  .add-card {
    margin-top: 4px;
    width: 100%;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #7e848c;
    font-size: 12px;
    padding: 6px;
    cursor: pointer;
    text-align: left;
  }

  .add-card:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--kanban-accent, var(--app-accent));
  }
</style>
