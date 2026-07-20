<script>
  // @ts-nocheck
  import { MIN_BPM, MAX_BPM, STEP_OPTIONS } from './musicModel';

  let {
    playing = false,
    bpm = 120,
    currentStep = -1,
    steps = 16,
    statusText = 'READY',
    onPlay,
    onStop,
    onBpmChange,
    onStepsChange,
  } = $props();

  function nudgeBpm(delta) {
    const next = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm + delta)));
    onBpmChange?.(next);
  }

  /** @param {Event} e */
  function onBpmInput(e) {
    const v = Number(/** @type {HTMLInputElement} */ (e.currentTarget).value);
    if (!Number.isFinite(v)) return;
    onBpmChange?.(Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v))));
  }
</script>

<div class="music-transport flex items-stretch gap-2 shrink-0">
  <div class="music-lcd flex-1 min-w-0 flex flex-col justify-center px-2 py-1">
    <div class="music-lcd-row flex items-baseline justify-between gap-2">
      <span class="music-lcd-title">nvAUX BEAT</span>
      <span class="music-lcd-status">{statusText}</span>
    </div>
    <div class="music-lcd-row flex items-end justify-between gap-2 mt-0.5">
      <span class="music-lcd-bpm">
        <span class="music-lcd-bpm-num">{bpm}</span>
        <span class="music-lcd-bpm-unit">BPM</span>
      </span>
      <div class="music-playhead-strip flex gap-0.5 min-w-0 overflow-hidden" aria-hidden="true">
        {#each Array(steps) as _, i (i)}
          <span
            class="music-playhead-dot"
            class:music-playhead-dot-on={playing && currentStep === i}
            class:music-playhead-dot-beat={i % 4 === 0}
          ></span>
        {/each}
      </div>
    </div>
  </div>

  <div class="music-transport-btns flex flex-col justify-center gap-1 shrink-0">
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="music-chunk-btn music-chunk-play"
        class:music-chunk-active={playing}
        onclick={() => onPlay?.()}
        aria-label={playing ? 'Playing' : 'Play'}
        title={playing ? 'Playing' : 'Play'}
      >
        ▶
      </button>
      <button
        type="button"
        class="music-chunk-btn"
        onclick={() => onStop?.()}
        aria-label="Stop"
        title="Stop"
      >
        ■
      </button>
      <div class="music-bpm-ctrl flex items-center gap-0.5">
        <button
          type="button"
          class="music-chunk-btn music-chunk-sm"
          onclick={() => nudgeBpm(-1)}
          aria-label="BPM down"
        >−</button>
        <input
          class="music-bpm-input"
          type="number"
          min={MIN_BPM}
          max={MAX_BPM}
          value={bpm}
          onchange={onBpmInput}
          aria-label="BPM"
        />
        <button
          type="button"
          class="music-chunk-btn music-chunk-sm"
          onclick={() => nudgeBpm(1)}
          aria-label="BPM up"
        >+</button>
      </div>
    </div>
    <div class="music-steps-seg flex items-center gap-0.5" role="group" aria-label="Step length">
      {#each STEP_OPTIONS as opt (opt)}
        <button
          type="button"
          class="music-steps-btn"
          class:music-steps-btn-on={steps === opt}
          onclick={() => onStepsChange?.(opt)}
          aria-pressed={steps === opt}
        >{opt}</button>
      {/each}
    </div>
  </div>
</div>

<style>
  .music-transport {
    padding: 6px;
    background: linear-gradient(180deg, #3a3a3e 0%, #2a2a2e 45%, #1e1e22 100%);
    border: 1px solid #111;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      0 1px 0 rgba(0, 0, 0, 0.4);
  }

  .music-lcd {
    --lcd: var(--app-accent, #ed0178);
    background: color-mix(in srgb, var(--lcd) 8%, #0a0a0c);
    border: 2px solid #111;
    box-shadow:
      inset 0 0 12px rgba(0, 0, 0, 0.85),
      inset 0 1px 0 color-mix(in srgb, var(--lcd) 18%, transparent);
    color: var(--lcd);
    font-family: 'Courier New', Courier, monospace;
    text-shadow: 0 0 6px color-mix(in srgb, var(--lcd) 55%, transparent);
    min-height: 48px;
  }

  .music-lcd-title {
    font-size: 10px;
    letter-spacing: 0.12em;
    opacity: 0.85;
  }

  .music-lcd-status {
    font-size: 10px;
    letter-spacing: 0.08em;
    opacity: 0.7;
  }

  .music-lcd-bpm-num {
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.04em;
  }

  .music-lcd-bpm-unit {
    font-size: 10px;
    margin-left: 4px;
    opacity: 0.75;
  }

  .music-playhead-dot {
    width: 5px;
    height: 8px;
    flex-shrink: 0;
    background: color-mix(in srgb, var(--app-accent, #ed0178) 12%, #0a0a0c);
    border: 1px solid color-mix(in srgb, var(--app-accent, #ed0178) 22%, #111);
  }

  .music-playhead-dot-beat {
    height: 10px;
  }

  .music-playhead-dot-on {
    background: var(--app-accent, #ed0178);
    box-shadow: 0 0 6px color-mix(in srgb, var(--app-accent, #ed0178) 70%, transparent);
    border-color: color-mix(in srgb, var(--app-accent, #ed0178) 80%, #fff);
  }

  .music-chunk-btn {
    min-width: 36px;
    height: 32px;
    padding: 0 8px;
    border: 1px solid #0a0a0a;
    border-radius: 3px;
    background: linear-gradient(180deg, #5a5a60 0%, #3a3a40 55%, #2c2c30 100%);
    color: #d8d8dc;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      0 1px 2px rgba(0, 0, 0, 0.45);
  }

  .music-chunk-btn:hover {
    filter: brightness(1.08);
  }

  .music-chunk-btn:active {
    filter: brightness(0.92);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.5);
  }

  .music-chunk-sm {
    min-width: 28px;
    height: 28px;
    font-size: 14px;
  }

  .music-chunk-play.music-chunk-active {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--app-accent, #ed0178) 70%, #fff) 0%,
      var(--app-accent, #ed0178) 55%,
      color-mix(in srgb, var(--app-accent, #ed0178) 55%, #000) 100%
    );
    color: #fff;
  }

  .music-bpm-input {
    width: 48px;
    height: 28px;
    text-align: center;
    background: #161618;
    border: 1px solid #0a0a0a;
    color: #c8c8cc;
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    border-radius: 2px;
    -moz-appearance: textfield;
  }

  .music-bpm-input::-webkit-outer-spin-button,
  .music-bpm-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .music-steps-btn {
    flex: 1;
    min-width: 28px;
    height: 20px;
    padding: 0 4px;
    font-size: 10px;
    font-family: 'Courier New', Courier, monospace;
    border: 1px solid #0a0a0a;
    border-radius: 2px;
    background: #2a2a30;
    color: #8a8a90;
    cursor: pointer;
  }

  .music-steps-btn-on {
    background: color-mix(in srgb, var(--app-accent, #ed0178) 40%, #2a2a30);
    color: #fff;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--app-accent, #ed0178) 50%, transparent);
  }
</style>
