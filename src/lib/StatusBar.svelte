<script>
  import {
    fullScreen,
    windowed,
    selectedNote,
    bodyText,
    markdownPreview,
  } from './store';
  import { isEmptyObject } from '../utils/isEmptyObject';
  import {
    buildTracksFromNote,
    mediaAddNext,
    mediaAddLast,
    mediaPlayNow,
    soundcloudUrlsFrom,
  } from './mediaSession';

  const SETTINGS_GUID = '00000000-0000-0000-0000-000000000000';

  let canPreview = $derived(
    !!$selectedNote &&
      !isEmptyObject($selectedNote) &&
      $selectedNote.guid !== SETTINGS_GUID
  );

  let hasSoundCloud = $derived(
    canPreview && soundcloudUrlsFrom($bodyText).length > 0
  );

  $effect(() => {
    if (!canPreview && $markdownPreview) {
      markdownPreview.set(false);
    }
  });

  function togglePreview() {
    markdownPreview.update((v) => !v);
  }

  function queueTracks(mode) {
    const tracks = buildTracksFromNote($selectedNote, $bodyText);
    if (!tracks.length) return;
    if (mode === 'next') mediaAddNext(tracks);
    else if (mode === 'last') mediaAddLast(tracks);
    else mediaPlayNow(tracks);
  }
</script>

<div
  class="status-bar px-2 items-center flex absolute w-full flex-grow-0 transition-all"
  style="font-size: 12px;  background: var(--app-statusbar-background); bottom: 0; left: 0; color: #606060; border-top: 1px solid var(--app-statusbar-border); height: {$fullScreen && !$windowed ? '45px' : '34px'};"
>
  <div class="flex-grow flex items-center">nvAux v0.1.7-20260716-001</div>
  {#if hasSoundCloud}
    <div class="media-actions flex items-center flex-shrink-0">
      <button type="button" class="status-btn" onclick={() => queueTracks('next')}>
        Add Next
      </button>
      <button type="button" class="status-btn" onclick={() => queueTracks('last')}>
        Add Last
      </button>
      <button type="button" class="status-btn primary" onclick={() => queueTracks('now')}>
        Play Now
      </button>
    </div>
  {/if}
  {#if canPreview}
    <button
      type="button"
      class="status-btn flex-shrink-0"
      class:active={$markdownPreview}
      onclick={togglePreview}
    >
      {$markdownPreview ? 'Edit' : 'Preview'}
    </button>
  {/if}
</div>

<style>
  .media-actions {
    gap: 4px;
    margin-right: 4px;
  }

  .status-btn {
    margin-left: 4px;
    padding: 2px 8px;
    border: 1px solid transparent;
    border-radius: 3px;
    background: transparent;
    color: #606060;
    font-size: 12px;
    line-height: 1.2;
    cursor: pointer;
  }

  .status-btn:hover {
    color: #8a8a8a;
    border-color: #404040;
  }

  .status-btn.active,
  .status-btn.primary:hover {
    color: rgba(255, 255, 255, 0.85);
    border-color: #525962;
    background: rgba(255, 255, 255, 0.06);
  }

  .status-btn.primary {
    color: #8a8a8a;
    border-color: #404040;
  }

  @media screen and (max-width: 768px) {
    .status-bar {
      align-items: start;
      padding-top: 10px;
    }
  }

  @media screen and (min-width: 769px) {
    .status-bar {
      align-items: center;
    }
  }
</style>
