<script>
  // @ts-nocheck
  import { onDestroy, untrack } from 'svelte';
  import {
    mediaPlayerHeight,
    selectNoteByGuid,
  } from './store';
  import {
    mediaPlaylist,
    mediaTrackIndex,
    mediaPlayRequest,
    mediaClearSession,
    mediaRemoveTrack,
    mediaReorderTrack,
    mediaAdvanceAfterFinish,
    mediaJumpTo,
  } from './mediaSession';

  const PLAYER_HEIGHT = 40;
  const WIDGET_API_SRC = 'https://w.soundcloud.com/player/api.js';
  const WIDGET_OPTS = {
    show_artwork: false,
    show_comments: false,
    sharing: false,
    download: false,
    buying: false,
    auto_play: false,
    visual: false,
    single_active: true,
  };

  /** @type {Promise<void> | null} */
  let widgetApiPromise = null;

  function loadWidgetApi() {
    if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
    if (window.SC?.Widget) return Promise.resolve();
    if (widgetApiPromise) return widgetApiPromise;

    widgetApiPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${WIDGET_API_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Widget API failed')));
        if (window.SC?.Widget) resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = WIDGET_API_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Widget API failed'));
      document.head.appendChild(script);
    });

    return widgetApiPromise;
  }

  function formatTime(ms) {
    if (!Number.isFinite(ms) || ms < 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /** @param {string} url */
  function shortUrl(url) {
    return url.replace(/^https?:\/\/(www\.)?/, '');
  }

  /** @param {{ url?: string, label?: string } | null | undefined} track */
  function trackPrimaryLabel(track) {
    if (!track) return '';
    if (track.label) return track.label;
    return track.url ? shortUrl(track.url) : '';
  }

  let playlist = $derived($mediaPlaylist);
  let trackIndex = $derived($mediaTrackIndex);
  let currentTrack = $derived(playlist[trackIndex] ?? null);
  let currentUrl = $derived(currentTrack?.url ?? '');
  let visible = $derived(playlist.length > 0);
  let hasMultiple = $derived(playlist.length > 1);
  let canPrev = $derived(trackIndex > 0);
  let canNext = $derived(trackIndex < playlist.length - 1);
  let trackLabel = $derived(hasMultiple ? `${trackIndex + 1}/${playlist.length}` : '');
  let sourceNoteName = $derived(currentTrack?.noteName ?? '');
  let sourceNoteGuid = $derived(currentTrack?.noteGuid ?? '');

  let playlistOpen = $state(false);
  let dragFromIndex = $state(-1);
  let dragOverIndex = $state(-1);

  let iframeEl = $state(null);
  /** Widget API instance — raw so Svelte does not proxy the third-party object. */
  let widget = $state.raw(null);
  let widgetBound = false;
  let loadedUrl = $state('');
  /** When true, play after the next successful load (prev/next / auto-advance / Play Now). */
  let playAfterLoad = false;

  /** oEmbed title for bare-URL tracks (skipped when markdown label is present). */
  let oembedTitle = $state('');
  let isPlaying = $state(false);
  let positionMs = $state(0);
  let durationMs = $state(0);
  let volume = $state(80);
  let ready = $state(false);
  let seeking = $state(false);

  let trackPart = $derived(
    currentTrack?.label || oembedTitle || (currentUrl ? shortUrl(currentUrl) : '')
  );
  let displayTitle = $derived.by(() => {
    const note = sourceNoteName;
    const track = trackPart;
    if (note && track) return `${note} · ${track}`;
    return note || track || '';
  });

  /** @type {HTMLDivElement | null} */
  let marqueeEl = $state(null);
  /** @type {HTMLSpanElement | null} */
  let marqueeMeasureEl = $state(null);
  let marqueeScrolling = $state(false);

  let currentLabel = $derived(formatTime(positionMs));
  let durationLabel = $derived(formatTime(durationMs));
  let seekMax = $derived(Math.max(durationMs, 1));
  let seekValue = $derived(Math.min(positionMs, seekMax));

  $effect(() => {
    mediaPlayerHeight.set(visible ? PLAYER_HEIGHT : 0);
    if (!visible) playlistOpen = false;
  });

  // Play Now / jump-to-play signals from the session API.
  $effect(() => {
    const token = $mediaPlayRequest;
    if (!token) return;
    playAfterLoad = true;
    const activeWidget = untrack(() => widget);
    const url = untrack(() => currentUrl);
    const loaded = untrack(() => loadedUrl);
    if (activeWidget && url && url === loaded && untrack(() => ready)) {
      playAfterLoad = false;
      activeWidget.play();
    }
  });

  $effect(() => {
    const url = currentUrl;
    const label = currentTrack?.label;
    if (!url) {
      oembedTitle = '';
      return;
    }
    // Prefer markdown link text; skip oEmbed when we already have a label.
    if (label) {
      oembedTitle = '';
      return;
    }

    let cancelled = false;
    oembedTitle = '';
    fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        oembedTitle = data.title || '';
      })
      .catch(() => {
        if (!cancelled) oembedTitle = '';
      });

    return () => {
      cancelled = true;
    };
  });

  // Overflow-aware marquee: scroll only when the combined title doesn't fit.
  $effect(() => {
    const text = displayTitle;
    const el = marqueeEl;
    const measure = marqueeMeasureEl;
    if (!el || !measure || !text) {
      marqueeScrolling = false;
      return;
    }

    const update = () => {
      marqueeScrolling = measure.scrollWidth > el.clientWidth + 1;
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  });

  function bindWidgetEvents(activeWidget) {
    if (widgetBound) return;
    widgetBound = true;

    activeWidget.bind(window.SC.Widget.Events.READY, () => {
      ready = true;
      activeWidget.setVolume(volume);
      activeWidget.getDuration((d) => {
        durationMs = d || 0;
      });
      if (playAfterLoad) {
        playAfterLoad = false;
        activeWidget.play();
      } else {
        activeWidget.isPaused((paused) => {
          isPlaying = !paused;
        });
      }
    });

    activeWidget.bind(window.SC.Widget.Events.PLAY, () => {
      isPlaying = true;
    });
    activeWidget.bind(window.SC.Widget.Events.PAUSE, () => {
      isPlaying = false;
    });
    activeWidget.bind(window.SC.Widget.Events.FINISH, () => {
      isPlaying = false;
      positionMs = 0;
      const advanced = mediaAdvanceAfterFinish();
      if (advanced) playAfterLoad = true;
    });
    activeWidget.bind(window.SC.Widget.Events.PLAY_PROGRESS, (e) => {
      if (seeking) return;
      positionMs = e.currentPosition || 0;
      if (!durationMs) {
        activeWidget.getDuration((d) => {
          if (d) durationMs = d;
        });
      }
    });
  }

  // Create the widget once when the iframe mounts with a track available.
  $effect(() => {
    const el = iframeEl;
    const url = currentUrl;

    if (!el || !url) {
      return;
    }

    if (untrack(() => widget)) return;

    let cancelled = false;
    const widgetUrl =
      `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}` +
      `&show_artwork=false&show_comments=false&sharing=false&download=false` +
      `&buying=false&auto_play=false&visual=false&single_active=true`;

    el.src = widgetUrl;

    loadWidgetApi()
      .then(() => {
        if (cancelled || !iframeEl) return;
        const activeWidget = window.SC.Widget(iframeEl);
        widget = activeWidget;
        loadedUrl = url;
        bindWidgetEvents(activeWidget);
      })
      .catch(() => {
        if (!cancelled) ready = false;
      });

    return () => {
      cancelled = true;
    };
  });

  // Load a different track without remounting the iframe / rebinding events.
  $effect(() => {
    const url = currentUrl;
    const activeWidget = widget;

    if (!url || !activeWidget) return;
    if (url === loadedUrl) return;

    let cancelled = false;
    let settled = false;
    const prevReady = untrack(() => ready);
    const prevPosition = untrack(() => positionMs);
    const prevDuration = untrack(() => durationMs);

    ready = false;
    positionMs = 0;
    durationMs = 0;

    activeWidget.load(url, {
      ...WIDGET_OPTS,
      callback() {
        if (cancelled) return;
        settled = true;
        loadedUrl = url;
        ready = true;
        activeWidget.setVolume(volume);
        activeWidget.getDuration((d) => {
          if (!cancelled) durationMs = d || 0;
        });
        if (playAfterLoad) {
          playAfterLoad = false;
          activeWidget.play();
        }
      },
    });

    return () => {
      cancelled = true;
      if (!settled && untrack(() => !!loadedUrl && currentUrl === loadedUrl)) {
        ready = prevReady;
        positionMs = prevPosition;
        durationMs = prevDuration;
      }
    };
  });

  // Tear down when the player hides (empty playlist).
  $effect(() => {
    if (visible) return;
    const activeWidget = untrack(() => widget);
    try {
      activeWidget?.pause?.();
    } catch {
      /* ignore */
    }
    widget = null;
    widgetBound = false;
    loadedUrl = '';
    ready = false;
    isPlaying = false;
    positionMs = 0;
    durationMs = 0;
    playAfterLoad = false;
  });

  onDestroy(() => {
    mediaPlayerHeight.set(0);
  });

  function togglePlay() {
    if (!widget || !ready) return;
    if (isPlaying) widget.pause();
    else widget.play();
  }

  function goPrev() {
    if (!canPrev) return;
    playAfterLoad = isPlaying;
    mediaJumpTo(trackIndex - 1, false);
  }

  function goNext() {
    if (!canNext) return;
    playAfterLoad = isPlaying;
    mediaJumpTo(trackIndex + 1, false);
  }

  function onSeekInput(e) {
    seeking = true;
    positionMs = Number(e.currentTarget.value);
  }

  function onSeekChange(e) {
    const ms = Number(e.currentTarget.value);
    positionMs = ms;
    seeking = false;
    widget?.seekTo?.(ms);
  }

  function onVolumeInput(e) {
    volume = Number(e.currentTarget.value);
    widget?.setVolume?.(volume);
  }

  function closePlayer() {
    try {
      widget?.pause?.();
    } catch {
      /* ignore */
    }
    mediaClearSession();
  }

  function openSourceNote() {
    if (!sourceNoteGuid) return;
    selectNoteByGuid(sourceNoteGuid);
  }

  function togglePlaylist() {
    playlistOpen = !playlistOpen;
  }

  function onRowPlay(index) {
    mediaJumpTo(index, true);
  }

  function onDragStart(index, e) {
    dragFromIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }

  function onDragOver(index, e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverIndex = index;
  }

  function onDrop(index, e) {
    e.preventDefault();
    const from = dragFromIndex >= 0 ? dragFromIndex : Number(e.dataTransfer.getData('text/plain'));
    if (Number.isFinite(from)) mediaReorderTrack(from, index);
    dragFromIndex = -1;
    dragOverIndex = -1;
  }

  function onDragEnd() {
    dragFromIndex = -1;
    dragOverIndex = -1;
  }
</script>

{#if visible}
  <div class="audio-player-shell relative flex-shrink-0 w-full">
    <div
      class="audio-player px-2 flex items-center gap-2 w-full"
      style="height: {PLAYER_HEIGHT}px; background: var(--app-statusbar-background); border-bottom: 1px solid var(--app-statusbar-border); color: #8a8a8a;"
      role="region"
      aria-label={displayTitle ? `Audio player: ${displayTitle}` : 'Audio player'}
    >
      <iframe
        bind:this={iframeEl}
        title="SoundCloud widget"
        allow="autoplay"
        class="sc-widget-host"
        scrolling="no"
        frameborder="no"
      ></iframe>

      <button
        type="button"
        class="note-chip flex items-center gap-1.5 flex-shrink-0 min-w-0"
        onclick={openSourceNote}
        title={sourceNoteName}
        aria-label={sourceNoteName ? `Open note ${sourceNoteName}` : 'Open source note'}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="flex-shrink-0"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span class="note-chip-name truncate">{sourceNoteName || 'Note'}</span>
      </button>

      {#if hasMultiple}
        <button
          type="button"
          class="nav-btn flex-shrink-0"
          onclick={goPrev}
          disabled={!canPrev || !ready}
          aria-label="Previous track"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
          </svg>
        </button>
      {/if}

      <button
        type="button"
        class="play-btn flex-shrink-0"
        onclick={togglePlay}
        disabled={!ready}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {#if isPlaying}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        {:else}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        {/if}
      </button>

      {#if hasMultiple}
        <button
          type="button"
          class="nav-btn flex-shrink-0"
          onclick={goNext}
          disabled={!canNext || !ready}
          aria-label="Next track"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16 6h2v12h-2V6zM6 18l8.5-6L6 6v12z" />
          </svg>
        </button>
        <span class="track-count flex-shrink-0" aria-label="Track">{trackLabel}</span>
      {/if}

      {#if displayTitle}
        <div
          class="track-title marquee min-w-0"
          class:scrolling={marqueeScrolling}
          bind:this={marqueeEl}
          title={displayTitle}
          style={marqueeScrolling
            ? `--marquee-duration: ${Math.max(10, displayTitle.length * 0.35)}s`
            : undefined}
        >
          <span class="marquee-measure" bind:this={marqueeMeasureEl} aria-hidden="true">
            {displayTitle}
          </span>
          <div class="marquee-viewport">
            <div class="marquee-track">
              <span class="marquee-text">{displayTitle}</span>
              {#if marqueeScrolling}
                <span class="marquee-text" aria-hidden="true">{displayTitle}</span>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <span class="time flex-shrink-0" aria-label="Current time">{currentLabel}</span>

      <input
        type="range"
        class="seek flex-grow min-w-0"
        min="0"
        max={seekMax}
        step="100"
        value={seekValue}
        disabled={!ready}
        oninput={onSeekInput}
        onchange={onSeekChange}
        aria-label="Seek"
      />

      <span class="time flex-shrink-0" aria-label="Duration">{durationLabel}</span>

      <label class="volume flex items-center flex-shrink-0" title="Volume">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"
          />
        </svg>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={volume}
          oninput={onVolumeInput}
          aria-label="Volume"
          disabled={!ready}
        />
      </label>

      <button
        type="button"
        class="icon-btn flex-shrink-0"
        class:active={playlistOpen}
        onclick={togglePlaylist}
        aria-label={playlistOpen ? 'Hide playlist' : 'Show playlist'}
        aria-expanded={playlistOpen}
        title="Playlist"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </button>

      <button
        type="button"
        class="icon-btn flex-shrink-0"
        onclick={closePlayer}
        aria-label="Close player"
        title="Close"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    {#if playlistOpen}
      <div class="playlist-panel thin-scrollbar" role="list" aria-label="Playlist">
        {#each playlist as track, index (track.id)}
          <div
            class="playlist-row flex items-center gap-2"
            class:current={index === trackIndex}
            class:played={track.played && index !== trackIndex}
            class:drag-over={dragOverIndex === index}
            role="listitem"
            draggable="true"
            ondragstart={(e) => onDragStart(index, e)}
            ondragover={(e) => onDragOver(index, e)}
            ondrop={(e) => onDrop(index, e)}
            ondragend={onDragEnd}
          >
            <span class="drag-handle flex-shrink-0" aria-hidden="true" title="Drag to reorder">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="6" r="1.5" />
                <circle cx="15" cy="6" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="18" r="1.5" />
                <circle cx="15" cy="18" r="1.5" />
              </svg>
            </span>
            <button
              type="button"
              class="playlist-main min-w-0 flex-grow flex flex-col items-start"
              onclick={() => onRowPlay(index)}
            >
              <span class="playlist-url truncate w-full" title={track.label || track.url}>
                {trackPrimaryLabel(track)}
              </span>
              <span class="playlist-note truncate w-full" title={track.noteName}>
                {track.noteName}
                {#if track.played && index !== trackIndex}
                  <span class="played-tag"> · played</span>
                {/if}
              </span>
            </button>
            <button
              type="button"
              class="icon-btn flex-shrink-0"
              onclick={() => mediaRemoveTrack(track.id)}
              aria-label="Remove track"
              title="Remove"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .audio-player-shell {
    z-index: 3;
  }

  .audio-player {
    font-size: 11px;
    box-sizing: border-box;
  }

  .sc-widget-host {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
    border: 0;
    overflow: hidden;
  }

  .note-chip {
    max-width: 9em;
    height: 28px;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: 3px;
    background: transparent;
    color: #a0a0a0;
    cursor: pointer;
  }

  .note-chip:hover {
    color: rgba(255, 255, 255, 0.9);
    border-color: #404040;
    background: rgba(255, 255, 255, 0.06);
  }

  .note-chip-name {
    font-size: 11px;
  }

  .play-btn,
  .nav-btn,
  .icon-btn {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: 3px;
    background: transparent;
    color: #a0a0a0;
    padding: 0;
    cursor: pointer;
  }

  .nav-btn {
    width: 24px;
  }

  .play-btn:hover:not(:disabled),
  .nav-btn:hover:not(:disabled),
  .icon-btn:hover {
    color: rgba(255, 255, 255, 0.9);
    border-color: #404040;
    background: rgba(255, 255, 255, 0.06);
  }

  .icon-btn.active {
    color: rgba(255, 255, 255, 0.9);
    border-color: #525962;
    background: rgba(255, 255, 255, 0.06);
  }

  .play-btn:disabled,
  .nav-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .track-count {
    font-variant-numeric: tabular-nums;
    min-width: 2.2em;
    color: #707070;
  }

  .track-title {
    flex: 0 1 14em;
    color: #a0a0a0;
    position: relative;
    overflow: hidden;
    min-width: 4em;
  }

  .marquee-measure {
    position: absolute;
    visibility: hidden;
    white-space: nowrap;
    pointer-events: none;
  }

  .marquee-viewport {
    overflow: hidden;
    width: 100%;
  }

  .marquee-track {
    display: inline-flex;
    white-space: nowrap;
    will-change: transform;
  }

  .marquee.scrolling .marquee-text {
    padding-right: 2.5em;
  }

  .marquee.scrolling .marquee-track {
    animation: marquee-scroll linear infinite;
    animation-duration: var(--marquee-duration, 12s);
  }

  @keyframes marquee-scroll {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-50%);
    }
  }

  .time {
    font-variant-numeric: tabular-nums;
    min-width: 2.4em;
    text-align: center;
    color: #707070;
  }

  .seek,
  .volume input {
    -webkit-appearance: none;
    appearance: none;
    height: 14px;
    background: transparent;
    cursor: pointer;
  }

  .seek {
    max-width: none;
  }

  .seek::-webkit-slider-runnable-track,
  .volume input::-webkit-slider-runnable-track {
    height: 3px;
    background: #2a2a2a;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 2px;
  }

  .seek::-moz-range-track,
  .volume input::-moz-range-track {
    height: 3px;
    background: #2a2a2a;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 2px;
  }

  .seek::-webkit-slider-thumb,
  .volume input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 9px;
    height: 9px;
    margin-top: -3.5px;
    border-radius: 50%;
    background: #555;
    border: 1px solid #404040;
    box-shadow: none;
  }

  .seek::-moz-range-thumb,
  .volume input::-moz-range-thumb {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #555;
    border: 1px solid #404040;
    box-shadow: none;
  }

  .seek:hover::-webkit-slider-thumb,
  .volume input:hover::-webkit-slider-thumb,
  .seek:hover::-moz-range-thumb,
  .volume input:hover::-moz-range-thumb {
    background: #666;
  }

  .volume {
    gap: 4px;
    color: #707070;
  }

  .volume input {
    width: 56px;
  }

  .playlist-panel {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 220px;
    overflow-y: auto;
    background: var(--app-statusbar-background);
    border-bottom: 1px solid var(--app-statusbar-border);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.35);
    z-index: 4;
  }

  .playlist-row {
    padding: 6px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    color: #8a8a8a;
  }

  .playlist-row.current {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.88);
  }

  .playlist-row.played {
    opacity: 0.55;
  }

  .playlist-row.drag-over {
    outline: 1px dashed #525962;
    outline-offset: -1px;
  }

  .drag-handle {
    color: #555;
    cursor: grab;
  }

  .playlist-main {
    border: 0;
    background: transparent;
    color: inherit;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }

  .playlist-url {
    font-size: 11px;
  }

  .playlist-note {
    font-size: 10px;
    color: #606060;
  }

  .playlist-row.current .playlist-note {
    color: #808080;
  }

  .played-tag {
    color: #555;
  }

  .gap-1\.5 {
    gap: 0.375rem;
  }

  .gap-2 {
    gap: 0.5rem;
  }
</style>
