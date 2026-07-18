<script>
  // @ts-nocheck

  let {
    card,
    density = 'comfortable',
    onRename,
    onDelete,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    dragOver = false,
  } = $props();

  let editing = $state(false);
  let draft = $state('');
  /** @type {HTMLInputElement | undefined} */
  let titleInput = $state();

  function startEdit() {
    draft = card.title ?? '';
    editing = true;
    queueMicrotask(() => titleInput?.focus?.());
  }

  function commitEdit() {
    if (!editing) return;
    editing = false;
    const next = draft.trim();
    if (next && next !== card.title) onRename?.(card.id, next);
  }

  function cancelEdit() {
    editing = false;
  }

  function onKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }
</script>

<div
  class="kanban-card"
  class:compact={density === 'compact'}
  class:drag-over={dragOver}
  class:editing
  draggable={!editing}
  ondragstart={(e) => onDragStart?.(card.id, e)}
  ondragover={(e) => onDragOver?.(card.id, e)}
  ondrop={(e) => onDrop?.(card.id, e)}
  ondragend={() => onDragEnd?.()}
  role="listitem"
>
  {#if editing}
    <input
      class="card-title-input"
      bind:this={titleInput}
      bind:value={draft}
      onblur={commitEdit}
      onkeydown={onKeydown}
      aria-label="Card title"
    />
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="card-title truncate" ondblclick={startEdit} title="Double-click to rename">
      {card.title}
    </div>
  {/if}
  <button
    type="button"
    class="card-delete"
    aria-label="Delete card"
    title="Delete card"
    onclick={() => onDelete?.(card.id)}
  >
    ×
  </button>
</div>

<style>
  .kanban-card {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 8px 10px;
    margin-bottom: 6px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--kanban-accent, var(--app-accent)) 8%, var(--app-omni-background));
    border: 1px solid color-mix(in srgb, var(--kanban-accent, var(--app-accent)) 22%, transparent);
    color: var(--text-color, rgba(255, 255, 255, 0.85));
    font-size: 13px;
    line-height: 1.35;
    cursor: grab;
    user-select: none;
  }

  .kanban-card.compact {
    padding: 5px 8px;
    margin-bottom: 4px;
    font-size: 12px;
  }

  .kanban-card:active {
    cursor: grabbing;
  }

  .kanban-card.drag-over {
    outline: 1px dashed var(--kanban-accent, var(--app-accent));
  }

  .kanban-card.editing {
    cursor: text;
  }

  .card-title {
    flex: 1;
    min-width: 0;
  }

  .card-title-input {
    flex: 1;
    min-width: 0;
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
    padding: 0;
  }

  .card-delete {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: #7e848c;
    cursor: pointer;
    line-height: 1;
    font-size: 16px;
    padding: 0;
  }

  .card-delete:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
  }
</style>
