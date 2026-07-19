<script>
  import {
    windowed,
    showClock,
    showStatusBar,
    fullScreen,
    isMobile,
    accentColor,
    ACCENT_COLOR_PRESETS,
  } from '$lib/store';
  import './settingsForms.css';
</script>

<div style="border: 1px solid #2b2d30; border-radius: 8px; margin-top: 20px; padding: 15px;">
  <div class="font-bold" style="margin-bottom: 15px">General Preferences</div>

  <div>
    <label for="showClock"><input id="showClock" type="checkbox" autocomplete="off" bind:checked={$showClock} /> Show Clock</label>
  </div>
  <div style="margin-top: 15px;">
    <label for="showStatusBar"><input id="showStatusBar" type="checkbox" autocomplete="off" bind:checked={$showStatusBar} /> Show Status bar</label>
  </div>
  <div style="margin-top: 15px;">
    <label for="fullScreen"><input id="fullScreen" type="checkbox" bind:checked={$fullScreen} /> App Mode</label>
  </div>
  <div style="margin-top: 3px; margin-left: 15px; opacity: {$fullScreen && !$isMobile ? 1 : 0.5}">
    <label for="windowed">
      <input
        id="windowed"
        type="checkbox"
        disabled={!$fullScreen || $isMobile}
        bind:checked={$windowed}
      />
      Windowed{$isMobile ? ' (desktop only)' : ''}
    </label>
  </div>
  <div style="margin-top: 15px;">
    <label for="accentColor">Accent color</label>
    <div class="flex items-center accent-color-row" style="margin-top: 8px;">
      <input
        id="accentColor"
        class="settings-input settings-color"
        type="color"
        bind:value={$accentColor}
      />
      <div class="flex items-center accent-presets" role="group" aria-label="Accent color presets">
        {#each ACCENT_COLOR_PRESETS as preset (preset)}
          <button
            type="button"
            class="accent-preset"
            class:accent-preset-selected={$accentColor.toLowerCase() === preset}
            style:background={preset}
            aria-label="Set accent to {preset}"
            aria-pressed={$accentColor.toLowerCase() === preset}
            onclick={() => {
              $accentColor = preset;
            }}
          ></button>
        {/each}
      </div>
    </div>
  </div>
</div>
