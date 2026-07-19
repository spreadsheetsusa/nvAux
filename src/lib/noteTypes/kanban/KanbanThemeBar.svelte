<script>
  // @ts-nocheck
  import { ACCENT_COLOR_PRESETS, DEFAULT_ACCENT_COLOR } from '$lib/accentPresets';

  let {
    theme = { density: 'comfortable' },
    onChange,
  } = $props();

  let accent = $derived(theme.accent || '');
  let density = $derived(theme.density === 'compact' ? 'compact' : 'comfortable');

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
</script>

<div class="kanban-theme-bar flex items-center gap-2 flex-shrink-0" role="group" aria-label="Board theme">
  <span class="label">Theme</span>
  <div class="presets flex items-center gap-1" role="group" aria-label="Accent presets">
    {#each ACCENT_COLOR_PRESETS as preset (preset)}
      <button
        type="button"
        class="swatch"
        class:active={(accent || DEFAULT_ACCENT_COLOR) === preset}
        style="background: {preset}"
        aria-label="Accent {preset}"
        onclick={() => setAccent(preset)}
      ></button>
    {/each}
  </div>
  <label class="custom flex items-center gap-1" title="Custom accent">
    <input
      type="color"
      value={accent || DEFAULT_ACCENT_COLOR}
      oninput={(e) => setAccent(e.currentTarget.value)}
      aria-label="Custom accent color"
    />
  </label>
  {#if accent}
    <button type="button" class="theme-btn" onclick={clearAccent}>App accent</button>
  {/if}
  <button
    type="button"
    class="theme-btn"
    class:active={density === 'compact'}
    onclick={toggleDensity}
  >
    {density === 'compact' ? 'Compact' : 'Comfortable'}
  </button>
</div>

<style>
  .kanban-theme-bar {
    padding: 6px 8px;
    border-bottom: 1px solid var(--app-statusbar-border, #2b2d30);
    font-size: 12px;
    color: #7e848c;
  }

  .label {
    flex-shrink: 0;
  }

  .swatch {
    width: 16px;
    height: 16px;
    border-radius: 999px;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
  }

  .swatch.active {
    border-color: rgba(255, 255, 255, 0.85);
  }

  .custom input {
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .theme-btn {
    border: 1px solid var(--app-statusbar-border, #2b2d30);
    border-radius: 4px;
    background: transparent;
    color: #7e848c;
    font-size: 11px;
    padding: 3px 8px;
    cursor: pointer;
  }

  .theme-btn:hover,
  .theme-btn.active {
    color: var(--text-color);
    border-color: var(--kanban-accent, var(--app-accent));
  }
</style>
