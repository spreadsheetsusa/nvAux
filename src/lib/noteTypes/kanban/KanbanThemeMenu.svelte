<script>
  // @ts-nocheck
  import { onMount, onDestroy } from 'svelte';
  import { ACCENT_COLOR_PRESETS, DEFAULT_ACCENT_COLOR } from '$lib/accentPresets';

  let {
    theme = { density: 'comfortable' },
    onChange,
  } = $props();

  let accent = $derived(theme.accent || '');
  let density = $derived(theme.density === 'compact' ? 'compact' : 'comfortable');

  let open = $state(false);
  /** @type {HTMLDivElement | undefined} */
  let rootEl = $state();
  /** @type {HTMLDivElement | undefined} */
  let menuEl = $state();

  function setAccent(color) {
    onChange?.({ ...theme, accent: color });
  }

  function clearAccent() {
    const next = { ...theme };
    delete next.accent;
    onChange?.(next);
  }

  function toggleDensity() {
    onChange?.({
      ...theme,
      density: density === 'compact' ? 'comfortable' : 'compact',
    });
  }

  function toggleOpen(e) {
    e.stopPropagation();
    open = !open;
  }

  function close() {
    open = false;
  }

  function handleClickOutside(event) {
    if (!open) return;
    if (rootEl?.contains(event.target)) return;
    close();
  }

  /** @param {KeyboardEvent} e */
  function handleKeydown(e) {
    if (e.key !== 'Escape' || !open) return;
    e.preventDefault();
    e.stopPropagation();
    close();
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleKeydown);
  });

  $effect(() => {
    if (!open) return;
    queueMicrotask(() => {
      const first = menuEl?.querySelector('button, input');
      if (first instanceof HTMLElement) first.focus();
    });
  });
</script>

<div class="kanban-theme-chrome flex items-center justify-end flex-shrink-0" bind:this={rootEl}>
  <div class="theme-anchor">
    <button
      type="button"
      class="theme-menu-btn bg-transparent flex items-center"
      aria-label="Board preferences"
      aria-haspopup="menu"
      aria-expanded={open}
      onclick={toggleOpen}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="feather feather-more-vertical"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="1"></circle>
        <circle cx="12" cy="5" r="1"></circle>
        <circle cx="12" cy="19" r="1"></circle>
      </svg>
    </button>

    {#if open}
      <div
        bind:this={menuEl}
        class="theme-menu context-menu"
        role="menu"
        tabindex="-1"
        aria-label="Board theme"
        onkeydown={handleKeydown}
      >
        <div class="menu-section-label">Accent</div>
        <div class="presets flex items-center gap-1 flex-wrap" role="group" aria-label="Accent presets">
          {#each ACCENT_COLOR_PRESETS as preset (preset)}
            <button
              type="button"
              role="menuitem"
              class="swatch"
              class:active={(accent || DEFAULT_ACCENT_COLOR) === preset}
              style="background: {preset}"
              aria-label="Accent {preset}"
              onclick={() => setAccent(preset)}
            ></button>
          {/each}
        </div>

        <label class="custom flex items-center gap-2" title="Custom accent">
          <span class="custom-label">Custom</span>
          <input
            type="color"
            value={accent || DEFAULT_ACCENT_COLOR}
            oninput={(e) => setAccent(e.currentTarget.value)}
            aria-label="Custom accent color"
          />
        </label>

        {#if accent}
          <button type="button" role="menuitem" class="menu-btn block w-full bg-transparent" onclick={clearAccent}>
            App accent
          </button>
        {/if}

        <div class="menu-divider"></div>

        <button
          type="button"
          role="menuitem"
          class="menu-btn block w-full bg-transparent"
          class:active={density === 'compact'}
          onclick={toggleDensity}
        >
          Density: {density === 'compact' ? 'Compact' : 'Comfortable'}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .kanban-theme-chrome {
    padding: 2px 4px 2px 8px;
    min-height: 28px;
  }

  .theme-anchor {
    position: relative;
  }

  .theme-menu-btn {
    width: 28px;
    height: 28px;
    justify-content: center;
    border: none;
    border-radius: 4px;
    color: #7e848c;
    cursor: pointer;
    padding: 0;
  }

  .theme-menu-btn:hover,
  .theme-menu-btn[aria-expanded='true'] {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.9);
  }

  .theme-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 1000;
    min-width: 200px;
    max-width: min(260px, calc(100vw - 24px));
    padding: 8px;
    background: var(--app-omni-background);
    border: 1px solid var(--app-statusbar-border, #2b2d30);
    border-radius: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    color: var(--text-color);
    font-size: 12px;
  }

  .menu-section-label {
    font-size: 11px;
    color: #7e848c;
    margin-bottom: 6px;
    user-select: none;
  }

  .presets {
    margin-bottom: 8px;
  }

  .swatch {
    width: 18px;
    height: 18px;
    border-radius: 999px;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }

  .swatch.active {
    border-color: rgba(255, 255, 255, 0.85);
  }

  .custom {
    margin-bottom: 6px;
    color: #7e848c;
  }

  .custom-label {
    font-size: 11px;
  }

  .custom input {
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .menu-divider {
    height: 1px;
    margin: 6px 0;
    background: var(--app-statusbar-border, #2b2d30);
  }

  .menu-btn {
    padding: 6px 8px;
    text-align: left;
    border: none;
    border-radius: 4px;
    color: var(--text-color);
    cursor: pointer;
    font-size: 12px;
  }

  .menu-btn:hover,
  .menu-btn.active {
    background: var(--app-notelist-odd-background, rgba(255, 255, 255, 0.06));
    color: var(--kanban-accent, var(--app-accent, var(--text-color)));
  }
</style>
