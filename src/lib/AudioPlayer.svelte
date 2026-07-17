<script>
  // @ts-nocheck
  import { onDestroy, untrack } from 'svelte';
  import { bodyText, fullScreen, windowed, mediaPlayerHeight, selectedNote } from './store';
  import { extractMediaLinks } from '../utils/extractMediaLinks';

  const PLAYER_HEIGHT = 40;
  const PLAYLIST_DEBOUNCE_MS = 1200;
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

  function soundcloudUrlsFrom(text) {
    return extractMediaLinks(text)
      .filter((l) => l.provider === 'soundcloud')
      .map((l) => l.url);
  }

  /** @type {string[]} */
  let playlist = $state([]);
  let trackIndex = $state(0);
  let playlistNoteGuid = $state('');

  let currentUrl = $derived(playlist[trackIndex] ?? '');
  let visible = $derived(playlist.length > 0);
  let hasMultiple = $derived(playlist.length > 1);
  let canPrev = $derived(trackIndex > 0);
  let canNext = $derived(trackIndex < playlist.length - 1);
  let trackLabel = $derived(
    hasMultiple ? `${trackIndex + 1}/${playlist.length}` : ''
  );

  let iframeEl = $state(null);
  /** Widget API instance — raw so Svelte does not proxy the third-party object. */
  let widget = $state.raw(null);
  let widgetBound = false;
  let loadedUrl = $state('');
  /** When true, play after the next successful load (prev/next / auto-advance). */
  let playAfterLoad = false;

  let artworkUrl = $state('');
  let title = $state('');
  let isPlaying = $state(false);
  let positionMs = $state(0);
  let durationMs = $state(0);
  let volume = $state(80);
  let ready = $state(false);
  let seeking = $state(false);

  let statusBarHeight = $derived($fullScreen && !$windowed ? 45 : 34);
  let currentLabel = $derived(formatTime(positionMs));
  let durationLabel = $derived(formatTime(durationMs));
  let seekMax = $derived(Math.max(durationMs, 1));
  let seekValue = $derived(Math.min(positionMs, seekMax));

  // Debounced playlist sync: append new URLs; reset only when the note changes.
  // Long debounce while a playlist exists so typing does not thrash the player.
  $effect(() => {
    const guid = $selectedNote?.guid ?? '';
    const text = $bodyText ?? '';
    const noteChanged = guid !== playlistNoteGuid;
    const delay = noteChanged ? 50 : playlist.length > 0 ? PLAYLIST_DEBOUNCE_MS : 200;

    const timer = setTimeout(() => {
      const found = soundcloudUrlsFrom(text);

      if (guid !== playlistNoteGuid) {
        playlistNoteGuid = guid;
        playlist = found;
        trackIndex = 0;
        return;
      }

      if (found.length === 0) {
        if (playlist.length) {
          playlist = [];
          trackIndex = 0;
        }
        return;
      }

      const existing = new Set(playlist);
      const additions = found.filter((url) => !existing.has(url));
      if (additions.length) {
        playlist = [...playlist, ...additions];
      }
    }, delay);

    return () => clearTimeout(timer);
  });

  $effect(() => {
    mediaPlayerHeight.set(visible ? PLAYER_HEIGHT : 0);
  });

  $effect(() => {
    const url = currentUrl;
    if (!url) {
      artworkUrl = '';
      title = '';
      return;
    }

    let cancelled = false;
    fetch(
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        artworkUrl = (data.thumbnail_url || '').replace(/^http:/, 'https:');
        title = data.title || '';
      })
      .catch(() => {
        if (!cancelled) {
          artworkUrl = '';
          title = '';
        }
      });

    return () => {
      cancelled = true;
    };
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
      activeWidget.isPaused((paused) => {
        isPlaying = !paused;
      });
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
      if (trackIndex < playlist.length - 1) {
        playAfterLoad = true;
        trackIndex += 1;
      }
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

    // untrack: assigning widget must not re-run/teardown this effect
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
      // Aborted load (e.g. prev/next back to the already-loaded URL): restore
      // controls instead of leaving ready=false and zeroed times.
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
    trackIndex -= 1;
  }

  function goNext() {
    if (!canNext) return;
    playAfterLoad = isPlaying;
    trackIndex += 1;
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
</script>

{#if visible}
  <div
    class="audio-player px-2 flex items-center gap-2 absolute w-full"
    style="height: {PLAYER_HEIGHT}px; bottom: {statusBarHeight}px; background: var(--app-statusbar-background); border-top: 1px solid var(--app-statusbar-border); color: #8a8a8a;"
    role="region"
    aria-label={title ? `Audio player: ${title}` : 'Audio player'}
  >
    <iframe
      bind:this={iframeEl}
      title="SoundCloud widget"
      allow="autoplay"
      class="sc-widget-host"
      scrolling="no"
      frameborder="no"
    ></iframe>

    <div class="artwork flex-shrink-0" aria-hidden="true">
      {#if artworkUrl}
        <img src={artworkUrl} alt="" width="28" height="28" />
      {:else}
        <div class="artwork-placeholder"></div>
      {/if}
    </div>

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
  </div>
{/if}

<style>
  .audio-player {
    z-index: 2;
    left: 0;
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

  .artwork,
  .artwork img,
  .artwork-placeholder {
    width: 28px;
    height: 28px;
    border-radius: 3px;
  }

  .artwork img {
    object-fit: cover;
    display: block;
  }

  .artwork-placeholder {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .play-btn,
  .nav-btn {
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
  }

  .nav-btn {
    width: 24px;
  }

  .play-btn:hover:not(:disabled),
  .nav-btn:hover:not(:disabled) {
    color: rgba(255, 255, 255, 0.9);
    border-color: #404040;
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

  .gap-2 {
    gap: 0.5rem;
  }
</style>
