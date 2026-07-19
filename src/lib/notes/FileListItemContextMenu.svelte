<script>
  import { onMount } from 'svelte';

  let {
    note,
    x = 0,
    y = 0,
    showOpenInNewWindow = false,
    updatedLabel = '',
    ondelete,
    onrename,
    onclose,
    onOpenInNewWindow,
  } = $props();

  /** @type {HTMLDivElement | undefined} */
  let menuEl = $state();

  function handleDelete() {
    ondelete?.(note);
  }

  function handleRename() {
    onrename?.(note);
  }

  function handleClose() {
    onclose?.();
  }

  function handleOpenInNewWindow() {
    onOpenInNewWindow?.(note);
  }

  /** @param {KeyboardEvent} e */
  function handleKeydown(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    handleClose();
  }

  onMount(() => {
    const first = menuEl?.querySelector('button');
    if (first instanceof HTMLButtonElement) first.focus();
  });
</script>

<div
  bind:this={menuEl}
  class="context-menu"
  role="menu"
  tabindex="-1"
  onkeydown={handleKeydown}
  style="position: fixed; left: {x}px; top: {y}px; background: var(--app-omni-background); border: 1px solid var(--app-statusbar-border); border-radius: 4px; padding: 5px; z-index: 1000;"
>
  {#if updatedLabel}
    <div class="block w-full text-sm text-gray-400 select-none px-2 py-1">
      {updatedLabel}
    </div>
  {/if}
  {#if showOpenInNewWindow}
    <button type="button" role="menuitem" class="block w-full bg-transparent" onclick={handleOpenInNewWindow}>
      Open in new window
    </button>
  {/if}
  <button type="button" role="menuitem" class="block w-full bg-transparent" onclick={handleRename}>Rename</button>
  <button type="button" role="menuitem" class="block w-full bg-transparent" onclick={handleDelete}>Delete</button>
  <button type="button" role="menuitem" class="block w-full bg-transparent" onclick={handleClose}>Close</button>
</div>

<style>
  button {
    padding: 5px 10px;
    text-align: left;
    border: none;
    color: var(--text-color);
    cursor: pointer;
  }

  button:hover {
    background: var(--app-notelist-odd-background);
  }
</style>
