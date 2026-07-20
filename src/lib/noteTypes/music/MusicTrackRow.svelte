<script>
  // @ts-nocheck

  let {
    track,
    steps = 16,
    currentStep = -1,
    playing = false,
    loadState = 'loading',
    onToggleStep,
    onToggleMute,
    onToggleSolo,
    onVolumeChange,
    onOpenSamplePicker,
    onAudition,
  } = $props();

  /** @type {HTMLButtonElement | undefined} */
  let sampleBtnEl = $state();

  /** @param {Event} e */
  function onVol(e) {
    const v = Number(/** @type {HTMLInputElement} */ (e.currentTarget).value);
    onVolumeChange?.(v);
  }

  let statusLabel = $derived(
    loadState === 'error'
      ? 'ERR'
      : loadState === 'loading'
        ? '…'
        : 'OK'
  );
</script>

<div
  class="music-track-row flex items-center gap-1.5"
  class:music-track-muted={track.mute}
  class:music-track-error={loadState === 'error'}
>
  <div class="music-track-meta flex items-center gap-1 shrink-0">
    <button
      type="button"
      class="music-ms-btn"
      class:music-ms-on={track.mute}
      onclick={() => onToggleMute?.()}
      title="Mute"
      aria-label="Mute {track.name}"
      aria-pressed={track.mute}
    >M</button>
    <button
      type="button"
      class="music-ms-btn music-ms-solo"
      class:music-ms-on={track.solo}
      onclick={() => onToggleSolo?.()}
      title="Solo"
      aria-label="Solo {track.name}"
      aria-pressed={track.solo}
    >S</button>
    <button
      bind:this={sampleBtnEl}
      type="button"
      class="music-sample-btn"
      onclick={() => onOpenSamplePicker?.(sampleBtnEl)}
      title="Change sample"
    >
      <span class="music-track-name truncate">{track.name}</span>
      <span class="music-load-pill" class:music-load-err={loadState === 'error'}>{statusLabel}</span>
    </button>
    <button
      type="button"
      class="music-audition-btn"
      onclick={() => onAudition?.()}
      title="Audition"
      aria-label="Audition {track.name}"
      disabled={loadState !== 'ready'}
    >♪</button>
    <input
      class="music-vol"
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={track.volume}
      oninput={onVol}
      aria-label="{track.name} volume"
      title="Volume"
    />
  </div>

  <div class="music-steps flex gap-0.5 min-w-0 overflow-x-auto thin-scrollbar">
    {#each Array(steps) as _, i (i)}
      {@const on = !!track.pattern[i]}
      {@const isPlayhead = playing && currentStep === i}
      {@const isBeat = i % 4 === 0}
      <button
        type="button"
        class="music-pad"
        class:music-pad-on={on}
        class:music-pad-playhead={isPlayhead}
        class:music-pad-beat={isBeat}
        onclick={() => onToggleStep?.(i)}
        aria-label="{track.name} step {i + 1}"
        aria-pressed={on}
      ></button>
    {/each}
  </div>
</div>

<style>
  .music-track-row {
    padding: 4px 6px;
    background: linear-gradient(180deg, #323236 0%, #262628 100%);
    border-bottom: 1px solid #1a1a1c;
  }

  .music-track-muted {
    opacity: 0.55;
  }

  .music-track-error .music-track-name {
    color: #ff8a8a;
  }

  .music-ms-btn {
    width: 22px;
    height: 22px;
    padding: 0;
    font-size: 10px;
    font-weight: 700;
    border: 1px solid #0a0a0a;
    border-radius: 2px;
    background: #3a3a40;
    color: #a0a0a4;
    cursor: pointer;
  }

  .music-ms-btn.music-ms-on {
    background: #6a3a20;
    color: #ffd0a0;
  }

  .music-ms-solo.music-ms-on {
    background: #3a5a20;
    color: #d0ffb0;
  }

  .music-sample-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 108px;
    height: 22px;
    padding: 0 6px;
    border: 1px solid #0a0a0a;
    border-radius: 2px;
    background: #1c1c1e;
    color: #d0d0d4;
    font-size: 11px;
    cursor: pointer;
    overflow: hidden;
  }

  .music-track-name {
    flex: 1;
    min-width: 0;
    text-align: left;
  }

  .music-load-pill {
    font-size: 9px;
    font-family: 'Courier New', Courier, monospace;
    color: color-mix(in srgb, var(--app-accent, #ed0178) 70%, #fff);
    opacity: 0.85;
  }

  .music-load-err {
    color: #ff6c6c;
  }

  .music-audition-btn {
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid #0a0a0a;
    border-radius: 2px;
    background: #3a3a40;
    color: #c8c8cc;
    font-size: 11px;
    cursor: pointer;
  }

  .music-audition-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .music-vol {
    width: 56px;
    accent-color: #6a6a70;
  }

  .music-pad {
    width: 18px;
    height: 22px;
    flex-shrink: 0;
    padding: 0;
    border: 1px solid #0e0e10;
    border-radius: 2px;
    background: linear-gradient(180deg, #2a2a2e 0%, #1a1a1e 100%);
    cursor: pointer;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .music-pad-beat {
    background: linear-gradient(180deg, #303038 0%, #1e1e24 100%);
  }

  .music-pad-on {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--app-accent, #ed0178) 75%, #fff) 0%,
      var(--app-accent, #ed0178) 55%,
      color-mix(in srgb, var(--app-accent, #ed0178) 55%, #000) 100%
    );
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--app-accent, #ed0178) 40%, #fff),
      0 0 5px color-mix(in srgb, var(--app-accent, #ed0178) 45%, transparent);
  }

  .music-pad-playhead {
    outline: 1px solid color-mix(in srgb, var(--app-accent, #ed0178) 80%, #fff);
    outline-offset: -1px;
  }

  .music-pad-on.music-pad-playhead {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--app-accent, #ed0178) 90%, #fff) 0%,
      color-mix(in srgb, var(--app-accent, #ed0178) 70%, #fff) 100%
    );
  }

  @media (max-width: 640px) {
    .music-sample-btn {
      width: 84px;
    }

    .music-vol {
      width: 40px;
    }

    .music-pad {
      width: 16px;
      height: 20px;
    }
  }
</style>
