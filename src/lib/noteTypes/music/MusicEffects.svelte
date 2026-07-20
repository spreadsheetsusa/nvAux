<script>
  // @ts-nocheck

  let {
    effects = {
      filterFreq: 12000,
      filterQ: 1,
      distortion: 0,
      delay: 0,
      delayTime: 0.25,
      reverb: 0,
    },
    onChange,
  } = $props();

  let collapsed = $state(false);

  /**
   * @param {string} key
   * @param {Event} e
   */
  function onSlider(key, e) {
    const v = Number(/** @type {HTMLInputElement} */ (e.currentTarget).value);
    if (!Number.isFinite(v)) return;
    onChange?.({ [key]: v });
  }
</script>

<div class="music-fx shrink-0">
  <button
    type="button"
    class="music-fx-toggle flex items-center justify-between w-full px-2 py-1"
    onclick={() => (collapsed = !collapsed)}
    aria-expanded={!collapsed}
  >
    <span class="music-fx-label">MASTER FX</span>
    <span class="music-fx-chevron">{collapsed ? '▸' : '▾'}</span>
  </button>

  {#if !collapsed}
    <div class="music-fx-grid px-2 pb-2">
      <label class="music-fx-ctrl">
        <span>Filter</span>
        <input
          type="range"
          min="200"
          max="12000"
          step="10"
          value={effects.filterFreq}
          oninput={(e) => onSlider('filterFreq', e)}
          aria-label="Filter cutoff"
        />
      </label>
      <label class="music-fx-ctrl">
        <span>Drive</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={effects.distortion}
          oninput={(e) => onSlider('distortion', e)}
          aria-label="Distortion"
        />
      </label>
      <label class="music-fx-ctrl">
        <span>Delay</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={effects.delay}
          oninput={(e) => onSlider('delay', e)}
          aria-label="Delay wet"
        />
      </label>
      <label class="music-fx-ctrl">
        <span>Reverb</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={effects.reverb}
          oninput={(e) => onSlider('reverb', e)}
          aria-label="Reverb wet"
        />
      </label>
    </div>
  {/if}
</div>

<style>
  .music-fx {
    background: linear-gradient(180deg, #2a2a2e 0%, #1e1e22 100%);
    border-top: 1px solid #111;
  }

  .music-fx-toggle {
    border: 0;
    background: transparent;
    color: #6a6a70;
    cursor: pointer;
    font-family: 'Courier New', Courier, monospace;
  }

  .music-fx-label {
    font-size: 9px;
    letter-spacing: 0.14em;
  }

  .music-fx-chevron {
    font-size: 10px;
  }

  .music-fx-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px 10px;
  }

  .music-fx-ctrl {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 9px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #8a8a90;
  }

  .music-fx-ctrl input[type='range'] {
    width: 100%;
    accent-color: #6a6a70;
  }

  @media (max-width: 640px) {
    .music-fx-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
