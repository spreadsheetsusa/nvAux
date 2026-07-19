<script>
  // @ts-nocheck
  import { untrack } from 'svelte';
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import ResizeHandle from '$lib/components/chrome/ResizeHandle.svelte';
  import { mediaViewerHeight } from '$lib/store';
  import { youtubeIdFromUrl } from '../../utils/extractMediaLinks';

  const VIEWER_SLIDE = { duration: 220, easing: cubicOut };
  const MIN_H = 120;
  const MAX_H = 480;
  const YT_API_SRC = 'https://www.youtube.com/iframe_api';

  /** @type {Promise<void> | null} */
  let ytApiPromise = null;

  function loadYouTubeApi() {
    if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
    if (window.YT?.Player) return Promise.resolve();
    if (ytApiPromise) return ytApiPromise;

    ytApiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try {
          prev?.();
        } catch {
          /* ignore */
        }
        resolve();
      };

      const existing = document.querySelector(`script[src="${YT_API_SRC}"]`);
      if (existing) {
        if (window.YT?.Player) resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = YT_API_SRC;
      script.async = true;
      script.onerror = () => reject(new Error('YouTube IFrame API failed'));
      document.head.appendChild(script);
    });

    return ytApiPromise;
  }

  let {
    provider = 'image',
    url = '',
    label = '',
    autoplay = false,
    onEnded,
    onPlayState,
    videoEl = $bindable(null),
    ytPlayer = $bindable(null),
  } = $props();

  /** @type {HTMLDivElement | null} */
  let ytHostEl = $state(null);
  let ytVideoId = $derived(provider === 'youtube' ? youtubeIdFromUrl(url) : null);

  $effect(() => {
    const el = videoEl;
    if (!el || provider !== 'video' || !autoplay) return;
    el.play?.().catch(() => {});
  });

  // Create / replace YouTube IFrame player when the video id changes.
  $effect(() => {
    const host = ytHostEl;
    const videoId = ytVideoId;

    if (!host || !videoId || provider !== 'youtube') {
      const prev = untrack(() => ytPlayer);
      if (prev) {
        try {
          prev.destroy?.();
        } catch {
          /* ignore */
        }
        ytPlayer = null;
      }
      return;
    }

    let cancelled = false;
    let player = null;
    const wantPlay = untrack(() => autoplay);

    loadYouTubeApi()
      .then(() => {
        if (cancelled || !ytHostEl) return;

        // Clear prior iframe/content before constructing a new player.
        host.replaceChildren();
        const mount = document.createElement('div');
        host.appendChild(mount);

        player = new window.YT.Player(mount, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: wantPlay ? 1 : 0,
            playsinline: 1,
            rel: 0,
            origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          },
          events: {
            onReady(e) {
              if (cancelled) return;
              ytPlayer = e.target;
              if (wantPlay || untrack(() => autoplay)) {
                try {
                  e.target.playVideo?.();
                } catch {
                  /* ignore */
                }
              }
            },
            onStateChange(e) {
              if (cancelled) return;
              const YT = window.YT;
              if (!YT?.PlayerState) return;
              if (e.data === YT.PlayerState.ENDED) {
                onPlayState?.(false);
                onEnded?.();
              } else if (e.data === YT.PlayerState.PLAYING) {
                onPlayState?.(true);
              } else if (
                e.data === YT.PlayerState.PAUSED ||
                e.data === YT.PlayerState.CUED
              ) {
                onPlayState?.(false);
              }
            },
          },
        });
        ytPlayer = player;
      })
      .catch(() => {
        if (!cancelled) ytPlayer = null;
      });

    return () => {
      cancelled = true;
      try {
        player?.destroy?.();
      } catch {
        /* ignore */
      }
      if (untrack(() => ytPlayer) === player) ytPlayer = null;
    };
  });

  // Honor late autoplay requests (Play Now / advance) on an already-ready player.
  $effect(() => {
    if (provider !== 'youtube' || !autoplay) return;
    const player = ytPlayer;
    if (!player?.playVideo) return;
    try {
      player.playVideo();
    } catch {
      /* ignore */
    }
  });

  function handleEnded() {
    onEnded?.();
  }
</script>

<div
  class="media-viewer flex flex-col flex-shrink-0 w-full"
  style="height: {$mediaViewerHeight}px"
  transition:slide={VIEWER_SLIDE}
  role="region"
  aria-label={label ? `Media: ${label}` : 'Media viewer'}
>
  <div class="viewer-stage flex-1 min-h-0 flex items-center justify-center overflow-hidden">
    {#if provider === 'video'}
      <video
        class="viewer-media"
        bind:this={videoEl}
        src={url}
        controls
        playsinline
        onended={handleEnded}
      >
        <track kind="captions" />
      </video>
    {:else if provider === 'youtube'}
      <div class="viewer-media yt-host" bind:this={ytHostEl}></div>
    {:else}
      <img class="viewer-media" src={url} alt={label || 'Image'} />
    {/if}
  </div>
  <ResizeHandle
    orientation="vertical"
    bind:value={$mediaViewerHeight}
    min={MIN_H}
    max={MAX_H}
    ariaLabel="Resize media viewer"
  />
</div>

<style>
  .media-viewer {
    background: #0e1012;
    border-bottom: 1px solid var(--app-statusbar-border);
    box-sizing: border-box;
  }

  .viewer-stage {
    padding: 6px 8px 0;
  }

  .viewer-media {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
  }

  video.viewer-media {
    width: auto;
    height: auto;
    background: #000;
  }

  .yt-host {
    width: 100%;
    height: 100%;
    background: #000;
    overflow: hidden;
  }

  .yt-host :global(iframe) {
    width: 100%;
    height: 100%;
    border: 0;
    border-radius: 4px;
  }
</style>
