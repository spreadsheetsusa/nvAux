<script>
  import { format } from 'date-fns';
  import { slide } from 'svelte/transition';
  import {
    selectedNote,
    bodyText,
    markdownPreview,
    setNoteSticky,
    setNoteLocked,
    toggleMarkdownPreviewForNoteType,
    isLockPinSet,
    verifyLockPin,
    promptSettingsForLockPin,
    unlockNoteSession,
    lockNoteSession,
    unlockedNoteActivity,
  } from './store';
  import { isEmptyObject } from '../utils/isEmptyObject';
  import {
    buildTracksFromNote,
    mediaAddNext,
    mediaAddLast,
    mediaPlayNow,
    hasQueueableMedia,
  } from './mediaSession';
  import { isNoteLocked, isNoteSticky } from './noteTypes/parseNoteMeta';
  import { resolveNoteType } from './noteTypes/resolveNoteType';
  import Icon from '$lib/components/Icon.svelte';

  const createdAtSlide = { axis: 'x', duration: 180 };
  const pinSlide = { axis: 'x', duration: 180 };

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

  let noteType = $derived(
    canPreview ? resolveNoteType(activeNote, activeBody) : 'empty'
  );
  let canSticky = $derived(canPreview && noteType === 'markdown');
  let stickyOn = $derived(canSticky && isNoteSticky(activeBody));
  let lockedOn = $derived(canPreview && isNoteLocked(activeBody));
  let unlockedMap = $derived($unlockedNoteActivity);
  let sessionUnlocked = $derived(
    !!activeNote?.guid && unlockedMap?.[activeNote.guid] != null
  );

  let hasMedia = $derived(canPreview && hasQueueableMedia(activeBody));

  async function toggleSticky() {
    if (!activeNote || !canSticky) return;
    await setNoteSticky(activeNote, !stickyOn);
  }

  let editingGuid = $state(null);
  let draftDate = $state('');
  let editingCreatedAt = $derived(
    editingGuid != null && editingGuid === activeNote?.guid
  );

  /** @type {null | 'lock' | 'relock' | 'unlock' | 'remove'} */
  let pinMode = $state(null);
  let pinGuid = $state(null);
  let pinDraft = $state('');
  let pinError = $state('');
  let pinEditing = $derived(!!pinMode && pinGuid != null);

  function togglePreview() {
    toggleMarkdownPreviewForNoteType(noteType);
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
    cancelPinEditor();
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

  function cancelPinEditor() {
    pinMode = null;
    pinGuid = null;
    pinDraft = '';
    pinError = '';
  }

  function openPinEditor(mode) {
    const guid = activeNote?.guid;
    if (!guid) return;
    cancelCreatedAtEditor();
    pinMode = mode;
    pinGuid = guid;
    pinDraft = '';
    pinError = '';
  }

  async function onLockClick() {
    if (!activeNote || !canPreview) return;
    if (!isLockPinSet()) {
      await promptSettingsForLockPin();
      return;
    }
    if (!lockedOn) {
      openPinEditor('lock');
      return;
    }
    if (sessionUnlocked) {
      openPinEditor('relock');
      return;
    }
    openPinEditor('unlock');
  }

  async function submitPin() {
    if (!activeNote || !pinMode) return;
    if (!verifyLockPin(pinDraft)) {
      pinError = 'Incorrect PIN';
      return;
    }
    const guid = activeNote.guid;
    if (pinMode === 'lock') {
      await setNoteLocked(activeNote, true);
    } else if (pinMode === 'relock') {
      lockNoteSession(guid);
    } else if (pinMode === 'unlock') {
      unlockNoteSession(guid);
    } else if (pinMode === 'remove') {
      await setNoteLocked(activeNote, false);
    }
    cancelPinEditor();
  }

  function onPinInput(event) {
    pinDraft = String(event.currentTarget.value || '')
      .replace(/\D/g, '')
      .slice(0, 6);
    pinError = '';
  }

  function handleCreatedAtKeydown(event) {
    if (editingCreatedAt) {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelCreatedAtEditor();
      }
      return;
    }
    if (pinEditing) {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelPinEditor();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        submitPin();
      }
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

  let pinActionLabel = $derived(
    pinMode === 'lock'
      ? 'Lock'
      : pinMode === 'relock'
        ? 'Lock now'
        : pinMode === 'remove'
          ? 'Remove'
          : 'Unlock'
  );
</script>

<svelte:window onkeydown={handleCreatedAtKeydown} />

{#if canPreview}
  <div class="note-toolbar flex items-center justify-between flex-shrink-0">
    {#if hasMedia}
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
            <Icon name="CalendarTime" class="calendar-time-icon" />
          </button>
        {/if}
      {/key}
      {#if pinEditing && pinGuid === activeNote?.guid}
        <div class="pin-editor flex items-center flex-shrink-0" transition:slide={pinSlide}>
          <input
            class="pin-input"
            type="password"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="PIN"
            aria-label="Lock PIN"
            value={pinDraft}
            oninput={onPinInput}
          />
          <button type="button" class="toolbar-btn" onclick={cancelPinEditor}>Cancel</button>
          {#if lockedOn && sessionUnlocked && (pinMode === 'relock' || pinMode === 'remove')}
            <button
              type="button"
              class="toolbar-btn"
              onclick={() => {
                pinMode = 'remove';
                pinError = '';
                if (pinDraft.length === 6) submitPin();
              }}
            >
              Remove lock
            </button>
          {/if}
          <button
            type="button"
            class="toolbar-btn accent"
            onclick={submitPin}
            disabled={pinDraft.length !== 6}
          >
            {pinActionLabel}
          </button>
          {#if pinError}
            <span class="pin-error">{pinError}</span>
          {/if}
        </div>
      {:else}
        <button
          type="button"
          class="toolbar-btn flex-shrink-0 icon-btn"
          class:active={lockedOn}
          aria-label={lockedOn
            ? sessionUnlocked
              ? 'Lock note again'
              : 'Unlock note'
            : 'Lock note'}
          title={lockedOn
            ? sessionUnlocked
              ? 'Lock again (PIN)'
              : 'Unlock with PIN'
            : 'Lock note with PIN'}
          onclick={onLockClick}
        >
          <Icon name="Lock" class="lock-icon" />
        </button>
      {/if}
      {#if canSticky}
        <button
          type="button"
          class="toolbar-btn flex-shrink-0 icon-btn"
          class:active={stickyOn}
          aria-label={stickyOn ? 'Unpin sticky' : 'Pin as sticky'}
          title={stickyOn
            ? 'Unpin sticky (use normal popup in Windowed)'
            : 'Pin as sticky note in Windowed mode'}
          onclick={toggleSticky}
        >
          <Icon name="Sticky" class="sticky-icon" />
        </button>
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

  .created-at-editor,
  .pin-editor {
    gap: 4px;
  }

  .created-at-input,
  .pin-input {
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

  .pin-input {
    width: 4.5em;
    letter-spacing: 0.15em;
    text-align: center;
  }

  .created-at-input:focus,
  .pin-input:focus {
    border-color: #525962;
  }

  .created-at-input::-webkit-calendar-picker-indicator {
    filter: invert(0.7);
    cursor: pointer;
  }

  .pin-error {
    font-size: 11px;
    color: #f87171;
    white-space: nowrap;
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

  .toolbar-btn:disabled {
    opacity: 0.45;
    cursor: default;
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

  .toolbar-btn :global(.calendar-time-icon),
  .toolbar-btn :global(.sticky-icon),
  .toolbar-btn :global(.lock-icon) {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    display: block;
  }
</style>
