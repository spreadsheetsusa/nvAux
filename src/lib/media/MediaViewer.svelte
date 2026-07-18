<script>
  // @ts-nocheck
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import ResizeHandle from '../ResizeHandle.svelte';
  import { mediaViewerHeight } from '../store';

  const VIEWER_SLIDE = { duration: 220, easing: cubicOut };
  const MIN_H = 120;
  const MAX_H = 480;

  let {
    provider = 'image',
    url = '',
    label = '',
    autoplay = false,
    onEnded,
    videoEl = $bindable(null),
  } = $props();

  $effect(() => {
    const el = videoEl;
    if (!el || provider !== 'video' || !autoplay) return;
    el.play?.().catch(() => {});
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
</style>
