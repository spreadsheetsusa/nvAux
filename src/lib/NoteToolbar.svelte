<script>
  import {
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

  /** Optional overrides for popup windows (local note/body). */
  let {
    note = undefined,
    body = undefined,
  } = $props();

  let activeNote = $derived(note !== undefined ? note : $selectedNote);
  let activeBody = $derived(body !== undefined ? body : $bodyText);

  let canPreview = $derived(
    !!activeNote &&
      !isEmptyObject(activeNote) &&
      activeNote.guid !== SETTINGS_GUID
  );

  let hasSoundCloud = $derived(
    canPreview && soundcloudUrlsFrom(activeBody).length > 0
  );

  function togglePreview() {
    markdownPreview.update((v) => !v);
  }

  function queueTracks(mode) {
    const tracks = buildTracksFromNote(activeNote, activeBody);
    if (!tracks.length) return;
    if (mode === 'next') mediaAddNext(tracks);
    else if (mode === 'last') mediaAddLast(tracks);
    else mediaPlayNow(tracks);
  }
</script>

{#if canPreview}
  <div class="note-toolbar flex items-center justify-end flex-shrink-0">
    {#if hasSoundCloud}
      <div class="media-actions flex items-center flex-shrink-0">
        <button type="button" class="toolbar-btn" onclick={() => queueTracks('next')}>
          Add Next
        </button>
        <button type="button" class="toolbar-btn" onclick={() => queueTracks('last')}>
          Add Last
        </button>
        <button type="button" class="toolbar-btn primary" onclick={() => queueTracks('now')}>
          Play Now
        </button>
      </div>
    {/if}
    <button
      type="button"
      class="toolbar-btn flex-shrink-0"
      class:active={$markdownPreview}
      onclick={togglePreview}
    >
      {$markdownPreview ? 'Edit' : 'Preview'}
    </button>
  </div>
{/if}

<style>
  .note-toolbar {
    gap: 4px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--app-statusbar-border, #2b2d30);
    background: transparent;
  }

  .media-actions {
    gap: 4px;
    margin-right: 0;
  }

  .toolbar-btn {
    margin-left: 0;
    padding: 2px 8px;
    border: 1px solid transparent;
    border-radius: 3px;
    background: transparent;
    color: #606060;
    font-size: 12px;
    line-height: 1.2;
    cursor: pointer;
  }

  .toolbar-btn:hover {
    color: #8a8a8a;
    border-color: #404040;
  }

  .toolbar-btn.active,
  .toolbar-btn.primary:hover {
    color: rgba(255, 255, 255, 0.85);
    border-color: #525962;
    background: rgba(255, 255, 255, 0.06);
  }

  .toolbar-btn.primary {
    color: #8a8a8a;
    border-color: #404040;
  }
</style>
