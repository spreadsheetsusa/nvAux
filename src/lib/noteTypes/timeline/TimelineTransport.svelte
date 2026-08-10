<script>
  // @ts-nocheck
  let {
    mode = 'relative',
    playing = false,
    playheadLabel = '0:00',
    canPlay = false,
    onPlay,
    onStop,
    onZoomIn,
    onZoomOut,
    onFit,
    onAddLane,
    onAddItem,
    onModeChange,
    onGoToday,
  } = $props();
</script>

<div class="tl-transport flex items-center gap-1.5 px-2 py-1.5 shrink-0 flex-wrap">
  <div class="tl-mode flex items-center gap-0.5" role="group" aria-label="Time mode">
    <button
      type="button"
      class="tl-chip"
      class:active={mode === 'relative'}
      onclick={() => onModeChange?.('relative')}
    >
      Relative
    </button>
    <button
      type="button"
      class="tl-chip"
      class:active={mode === 'calendar'}
      onclick={() => onModeChange?.('calendar')}
    >
      Calendar
    </button>
  </div>

  <div class="tl-sep" aria-hidden="true"></div>

  {#if canPlay}
    {#if playing}
      <button type="button" class="tl-btn accent" onclick={() => onStop?.()} title="Stop">
        Stop
      </button>
    {:else}
      <button type="button" class="tl-btn accent" onclick={() => onPlay?.()} title="Play">
        Play
      </button>
    {/if}
    <span class="tl-playhead-label tabular-nums text-xs opacity-70">{playheadLabel}</span>
  {:else if mode === 'calendar'}
    <button type="button" class="tl-btn" onclick={() => onGoToday?.()} title="Scroll to today">
      Today
    </button>
  {/if}

  <div class="flex-1 min-w-2"></div>

  <button type="button" class="tl-btn" onclick={() => onZoomOut?.()} title="Zoom out">−</button>
  <button type="button" class="tl-btn" onclick={() => onZoomIn?.()} title="Zoom in">+</button>
  <button type="button" class="tl-btn" onclick={() => onFit?.()} title="Fit contents">Fit</button>

  <div class="tl-sep" aria-hidden="true"></div>

  <button type="button" class="tl-btn" onclick={() => onAddItem?.()} title="Add step">+ Step</button>
  <button type="button" class="tl-btn" onclick={() => onAddLane?.()} title="Add lane">+ Lane</button>
</div>

<style>
  .tl-transport {
    background: var(--app-omni-background);
    border-bottom: 1px solid var(--app-statusbar-border);
    color: var(--text-color);
  }
  .tl-chip,
  .tl-btn {
    border: 1px solid var(--app-statusbar-border);
    background: var(--app-background);
    color: var(--text-color);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 12px;
    line-height: 1.3;
    cursor: pointer;
    white-space: nowrap;
  }
  .tl-chip.active {
    border-color: color-mix(in srgb, var(--app-accent) 55%, var(--app-statusbar-border));
    background: color-mix(in srgb, var(--app-accent) 16%, var(--app-background));
  }
  .tl-btn.accent {
    background: var(--app-accent);
    border-color: var(--app-accent);
    color: #fff;
  }
  .tl-btn:hover,
  .tl-chip:hover {
    filter: brightness(1.03);
  }
  .tl-sep {
    width: 1px;
    height: 16px;
    background: var(--app-statusbar-border);
    margin: 0 2px;
  }
  .tl-playhead-label {
    min-width: 3.5rem;
  }
</style>
