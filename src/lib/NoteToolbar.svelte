<script>
  import { format } from 'date-fns';
  import { slide } from 'svelte/transition';
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
    hasSoundCloudLinks,
  } from './mediaSession';
  import IconCalendarTime from './IconCalendarTime.svelte';

  const createdAtSlide = { axis: 'x', duration: 180 };

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

  let hasSoundCloud = $derived(canPreview && hasSoundCloudLinks(activeBody));

  let editingGuid = $state(null);
  let draftDate = $state('');
  let editingCreatedAt = $derived(
    editingGuid != null && editingGuid === activeNote?.guid
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

  function openCreatedAtEditor() {
    const ts = activeNote?.createdAt;
    const guid = activeNote?.guid;
    if (ts == null || !guid) return;
    draftDate = format(ts, 'yyyy-MM-dd');
    editingGuid = guid;
  }

  function cancelCreatedAtEditor() {
    editingGuid = null;
    draftDate = '';
  }

  /** Runs when the icon control mounts (including after a note switch). */
  function attachResetCreatedAtEditor() {
    if (editingGuid != null) {
      editingGuid = null;
      draftDate = '';
    }
  }

  function handleCreatedAtKeydown(event) {
    if (!editingCreatedAt) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelCreatedAtEditor();
    }
  }

  async function applyCreatedAt() {
    if (!activeNote || !draftDate) return;

    const prev = new Date(activeNote.createdAt);
    const [year, month, day] = draftDate.split('-').map(Number);
    if (!year || !month || !day) return;

    const next = new Date(
      year,
      month - 1,
      day,
      prev.getHours(),
      prev.getMinutes(),
      prev.getSeconds(),
      prev.getMilliseconds()
    );
    const nextTs = next.getTime();
    if (Number.isNaN(nextTs)) return;

    await activeNote.incrementalModify((data) => {
      data.createdAt = nextTs;
      return data;
    });

    cancelCreatedAtEditor();
  }
</script>

<svelte:window onkeydown={handleCreatedAtKeydown} />

{#if canPreview}
  <div class="note-toolbar flex items-center justify-between flex-shrink-0">
    {#if hasSoundCloud}
      <div class="media-actions flex items-center flex-shrink-0">
        <button type="button" class="toolbar-btn accent" onclick={() => queueTracks('now')}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            class="flex-shrink-0"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          Play Now
        </button>
        <button type="button" class="toolbar-btn primary" onclick={() => queueTracks('next')}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            class="flex-shrink-0"
          >
            <path d="M4 6h10v2H4V6zm0 5h8v2H4v-2zm0 5h6v2H4v-2z" />
            <path d="M16 11v4.5l4-2.25L16 11z" />
          </svg>
          Play Next
        </button>
        <button type="button" class="toolbar-btn primary" onclick={() => queueTracks('last')}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            class="flex-shrink-0"
          >
            <path d="M4 6h10v2H4V6zm0 5h10v2H4v-2zm0 5h6v2H4v-2z" />
            <path d="M18 14v2h-2v2h2v2h2v-2h2v-2h-2v-2h-2z" />
          </svg>
          Add Last
        </button>
      </div>
    {/if}
    <div class="toolbar-trailing flex items-center flex-shrink-0 ml-auto">
      {#key activeNote?.guid}
        {#if editingCreatedAt}
          <div
            class="created-at-editor flex items-center flex-shrink-0"
            transition:slide={createdAtSlide}
          >
            <input
              class="created-at-input"
              type="date"
              bind:value={draftDate}
              aria-label="Creation date"
            />
            <button type="button" class="toolbar-btn" onclick={cancelCreatedAtEditor}>
              Cancel
            </button>
            <button type="button" class="toolbar-btn accent" onclick={applyCreatedAt}>
              Update
            </button>
          </div>
        {:else}
          <button
            type="button"
            class="toolbar-btn flex-shrink-0 icon-btn"
            aria-label="Set creation date"
            title="Set creation date"
            onclick={openCreatedAtEditor}
            {@attach attachResetCreatedAtEditor}
            transition:slide={createdAtSlide}
          >
            <IconCalendarTime class="calendar-time-icon" />
          </button>
        {/if}
      {/key}
      <button
        type="button"
        class="toolbar-btn flex-shrink-0"
        class:active={$markdownPreview}
        onclick={togglePreview}
      >
        {$markdownPreview ? 'Edit' : 'Preview'}
      </button>
    </div>
  </div>
{/if}

<style>
  .note-toolbar {
    gap: 4px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--app-statusbar-border, #2b2d30);
    background: color-mix(in srgb, var(--app-notedetail-background), #fff 6%);
  }

  .media-actions {
    gap: 4px;
    margin-right: 0;
  }

  .toolbar-trailing {
    gap: 4px;
  }

  .created-at-editor {
    gap: 4px;
  }

  .created-at-input {
    box-sizing: border-box;
    height: 22px;
    padding: 0 6px;
    border: 1px solid #404040;
    border-radius: 3px;
    background: #1a1c1e;
    color: #e5e7eb;
    font-size: 12px;
    line-height: 1.2;
    color-scheme: dark;
    outline: none;
  }

  .created-at-input:focus {
    border-color: #525962;
  }

  .created-at-input::-webkit-calendar-picker-indicator {
    filter: invert(0.7);
    cursor: pointer;
  }

  .toolbar-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
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

  .toolbar-btn.icon-btn {
    padding: 2px 6px;
  }

  .toolbar-btn:hover {
    color: #8a8a8a;
    border-color: #404040;
  }

  .toolbar-btn.active {
    color: rgba(255, 255, 255, 0.85);
    border-color: #525962;
    background: rgba(255, 255, 255, 0.06);
  }

  .toolbar-btn.primary {
    color: #fff;
    border-color: var(--app-accent);
  }

  .toolbar-btn.primary:hover {
    color: #fff;
    border-color: var(--app-accent);
    background: color-mix(in srgb, var(--app-accent) 12%, transparent);
  }

  .toolbar-btn.accent {
    color: #fff;
    border-color: var(--app-accent);
    background: var(--app-accent);
  }

  .toolbar-btn.accent:hover {
    color: #fff;
    border-color: var(--app-accent);
    background: color-mix(in srgb, var(--app-accent) 88%, #fff);
  }

  .toolbar-btn :global(.calendar-time-icon) {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    display: block;
  }
</style>
