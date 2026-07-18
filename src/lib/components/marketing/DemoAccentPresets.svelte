<script>
  import { accentColor, ACCENT_COLOR_PRESETS } from '../../store';
</script>

<div class="demo-accent-presets" role="group" aria-label="Accent color presets">
  {#each ACCENT_COLOR_PRESETS as preset (preset)}
    <button
      type="button"
      class="demo-accent-swatch"
      class:selected={$accentColor.toLowerCase() === preset}
      style:background={preset}
      aria-label="Set accent to {preset}"
      aria-pressed={$accentColor.toLowerCase() === preset}
      onclick={() => {
        $accentColor = preset;
      }}
    ></button>
  {/each}
</div>

<style>
  .demo-accent-presets {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin: 1.15rem 0 0;
  }
  .demo-accent-swatch {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid transparent;
    padding: 0;
    cursor: pointer;
    flex-shrink: 0;
    box-shadow:
      0 4px 12px -4px rgba(0, 0, 0, 0.45),
      inset 0 0 0 1px rgba(255, 255, 255, 0.18);
    transition:
      transform 140ms ease,
      box-shadow 140ms ease,
      border-color 140ms ease;
  }
  .demo-accent-swatch:hover {
    transform: translateY(-1px) scale(1.06);
    box-shadow:
      0 8px 16px -6px rgba(0, 0, 0, 0.5),
      inset 0 0 0 1px rgba(255, 255, 255, 0.3);
  }
  .demo-accent-swatch:active {
    transform: translateY(0) scale(0.98);
  }
  .demo-accent-swatch.selected {
    border-color: rgba(255, 255, 255, 0.92);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.35),
      0 6px 18px -4px color-mix(in srgb, var(--app-accent, #ed0178) 70%, transparent),
      inset 0 0 0 1px rgba(255, 255, 255, 0.2);
  }
  .demo-accent-swatch:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.75);
    outline-offset: 3px;
  }
</style>
