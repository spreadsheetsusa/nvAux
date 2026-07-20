<script>
  import { onMount } from 'svelte';
  import { positionFixedMenu } from '../../utils/positionFixedMenu.js';

  let {
    note,
    anchorRect = null,
    showOpenInNewWindow = false,
    updatedLabel = '',
    ondelete,
    onrename,
    onclose,
    onCloseNote,
    onOpenInNewWindow,
  } = $props();

  /** @type {HTMLDivElement | undefined} */
  let menuEl = $state();

  function reposition() {
    if (!menuEl || !anchorRect) return;
    positionFixedMenu(anchorRect, menuEl);
  }

  function handleDelete() {
    ondelete?.(note);
  }

  function handleRename() {
    onrename?.(note);
  }

  function dismiss() {
    onclose?.();
  }

  function handleCloseNote() {
    onCloseNote?.(note);
  }

  function handleOpenInNewWindow() {
    onOpenInNewWindow?.(note);
  }

  /** @param {KeyboardEvent} e */
  function handleKeydown(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    dismiss();
  }

  /** @param {FocusEvent} e */
  function handleFocusOut(e) {
    const next = /** @type {Node | null} */ (e.relatedTarget);
    if (next && menuEl?.contains(next)) return;
    // Defer so focus moves between menuitems don't dismiss.
    queueMicrotask(() => {
      if (menuEl?.contains(document.activeElement)) return;
      dismiss();
    });
  }

  onMount(() => {
    const first = menuEl?.querySelector('button');
    if (first instanceof HTMLButtonElement) first.focus();
  });

  $effect(() => {
    if (!menuEl || !anchorRect) return;
    reposition();

    /** @param {PointerEvent} e */
    function onPointerDown(e) {
      if (menuEl?.contains(/** @type {Node} */ (e.target))) return;
      dismiss();
    }

    window.addEventListener('resize', reposition);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('resize', reposition);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  });
</script>

<div
  bind:this={menuEl}
  class="context-menu"
  role="menu"
  tabindex="-1"
  onkeydown={handleKeydown}
  onfocusout={handleFocusOut}
  style="position: fixed; left: 0; top: 0; background: var(--app-omni-background); border: 1px solid var(--app-statusbar-border); border-radius: 4px; padding: 5px; z-index: 1000;"
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
  <button type="button" role="menuitem" class="block w-full bg-transparent" onclick={handleCloseNote}>Close</button>
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
