<script>
  // @ts-nocheck
  /**
   * Timeline clip bar — move + edge resize via pointer events.
   * Parent owns geometry (left/width) and persistence.
   */
  let {
    item,
    left = 0,
    width = 40,
    selected = false,
    onPointerBegin,
    onSelect,
    onRename,
    onToggleAlert,
    onDelete,
  } = $props();

  let editing = $state(false);
  /** @type {HTMLInputElement | undefined} */
  let inputEl = $state();

  function beginEdit() {
    editing = true;
    queueMicrotask(() => {
      inputEl?.focus();
      inputEl?.select();
    });
  }

  function commitEdit() {
    if (!editing) return;
    editing = false;
    const next = (inputEl?.value ?? '').trim();
    if (next && next !== item.title) onRename?.(item.id, next);
  }

  /** @param {KeyboardEvent} e */
  function onEditKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      editing = false;
    }
  }

  /**
   * @param {PointerEvent} e
   * @param {'move' | 'resize-start' | 'resize-end'} kind
   */
  function onDown(e, kind) {
    if (editing) return;
    if (e.button != null && e.button !== 0) return;
    e.stopPropagation();
    onSelect?.(item.id);
    onPointerBegin?.(e, item.id, kind);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="tl-clip absolute top-1.5 bottom-1.5 rounded-sm flex items-stretch overflow-hidden select-none"
  class:selected
  class:alert={!!item.alert}
  style="left: {left}px; width: {Math.max(width, 12)}px; --clip-color: {item.color ||
    'var(--app-accent)'}"
  onpointerdown={(e) => onDown(e, 'move')}
  ondblclick={(e) => {
    e.stopPropagation();
    beginEdit();
  }}
  title={item.title}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="tl-handle tl-handle-start"
    onpointerdown={(e) => onDown(e, 'resize-start')}
  ></div>

  <div class="tl-clip-body flex-1 min-w-0 flex items-center gap-1 px-1.5">
    {#if item.alert}
      <span class="tl-alert-dot shrink-0" aria-hidden="true"></span>
    {/if}
    {#if editing}
      <input
        bind:this={inputEl}
        class="tl-clip-input"
        value={item.title}
        onblur={commitEdit}
        onkeydown={onEditKey}
        onpointerdown={(e) => e.stopPropagation()}
      />
    {:else}
      <span class="tl-clip-title truncate text-xs font-medium">{item.title}</span>
    {/if}
  </div>

  {#if selected}
    <div class="tl-clip-actions shrink-0 flex items-center gap-0.5 pr-0.5">
      <button
        type="button"
        class="tl-mini-btn"
        class:on={!!item.alert}
        title={item.alert ? 'Disable alert' : 'Alert when playhead hits'}
        aria-label="Toggle alert"
        onpointerdown={(e) => e.stopPropagation()}
        onclick={(e) => {
          e.stopPropagation();
          onToggleAlert?.(item.id);
        }}
      >
        Al
      </button>
      <button
        type="button"
        class="tl-mini-btn"
        title="Delete"
        aria-label="Delete step"
        onpointerdown={(e) => e.stopPropagation()}
        onclick={(e) => {
          e.stopPropagation();
          onDelete?.(item.id);
        }}
      >
        ×
      </button>
    </div>
  {/if}

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="tl-handle tl-handle-end"
    onpointerdown={(e) => onDown(e, 'resize-end')}
  ></div>
</div>

<style>
  .tl-clip {
    background: color-mix(in srgb, var(--clip-color) 28%, var(--app-omni-background));
    border: 1px solid color-mix(in srgb, var(--clip-color) 55%, transparent);
    color: var(--text-color);
    touch-action: none;
    cursor: grab;
  }
  .tl-clip.selected {
    background: color-mix(in srgb, var(--clip-color) 42%, var(--app-omni-background));
    border-color: var(--clip-color);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--clip-color) 40%, transparent);
  }
  .tl-clip.alert {
    border-style: dashed;
  }
  .tl-clip:active {
    cursor: grabbing;
  }
  .tl-handle {
    width: 10px;
    flex-shrink: 0;
    cursor: ew-resize;
    touch-action: none;
  }
  .tl-handle-start {
    border-right: 1px solid color-mix(in srgb, var(--clip-color) 35%, transparent);
  }
  .tl-handle-end {
    border-left: 1px solid color-mix(in srgb, var(--clip-color) 35%, transparent);
  }
  .tl-alert-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--clip-color);
  }
  .tl-clip-input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 12px;
    font-weight: 500;
  }
  .tl-mini-btn {
    border: 0;
    background: transparent;
    color: inherit;
    opacity: 0.75;
    font-size: 11px;
    line-height: 1;
    padding: 2px 3px;
    cursor: pointer;
  }
  .tl-mini-btn:hover {
    opacity: 1;
  }
  .tl-mini-btn.on {
    opacity: 1;
    color: var(--clip-color);
    font-weight: 700;
  }
</style>
