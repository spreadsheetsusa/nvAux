<script>
  import { format } from 'date-fns';
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
    SETTINGS_GUID,
  } from '$lib/store';
  import { isEmptyObject } from '../../utils/isEmptyObject';
  import {
    buildTracksFromNote,
    mediaAddNext,
    mediaAddLast,
    mediaPlayNow,
    hasQueueableMedia,
  } from '$lib/media/mediaSession';
  import { isNoteLocked, isNoteSticky } from '$lib/noteTypes/parseNoteMeta';
  import { isRichNoteType, resolveNoteType } from '$lib/noteTypes/resolveNoteType';
  import { getNoteTypeProperties } from '$lib/noteTypes/noteTypeProperties';
  import Icon from '$lib/components/Icon.svelte';
  import ToolbarMediaActions from './ToolbarMediaActions.svelte';
  import ToolbarCreatedAt from './ToolbarCreatedAt.svelte';
  import ToolbarPinEditor from './ToolbarPinEditor.svelte';
  import './toolbarShared.css';


  /** Optional overrides for popup windows (local note/body). */
  let {
    note = undefined,
    body = undefined,
    onBodyChange = undefined,
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
  let PropertiesMenu = $derived(getNoteTypeProperties(noteType));
  let showProperties = $derived(
    !!PropertiesMenu && (!lockedOn || sessionUnlocked)
  );

  let hasMedia = $derived(
    canPreview && !isRichNoteType(noteType) && hasQueueableMedia(activeBody)
  );

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
        event.stopPropagation();
        cancelCreatedAtEditor();
      }
      return;
    }
    if (pinEditing) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
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
      <ToolbarMediaActions onQueue={queueTracks} />
    {/if}
    <div class="toolbar-trailing flex items-center flex-shrink-0 ml-auto">
      {#key activeNote?.guid}
        <ToolbarCreatedAt
          editing={editingCreatedAt}
          {draftDate}
          onDraftDateChange={(v) => {
            draftDate = v;
          }}
          onOpen={openCreatedAtEditor}
          onCancel={cancelCreatedAtEditor}
          onApply={applyCreatedAt}
          onAttachReset={attachResetCreatedAtEditor}
        />
      {/key}
      <ToolbarPinEditor
        editing={pinEditing && pinGuid === activeNote?.guid}
        {pinDraft}
        {pinError}
        {pinActionLabel}
        {pinMode}
        {lockedOn}
        {sessionUnlocked}
        {onPinInput}
        onCancel={cancelPinEditor}
        onSubmit={submitPin}
        onRemoveLock={() => {
          pinMode = 'remove';
          pinError = '';
          if (pinDraft.length === 6) submitPin();
        }}
        {onLockClick}
      />
      {#if canSticky}
        <button
          type="button"
          class="toolbar-btn flex-shrink-0 icon-btn"
          class:active={stickyOn}
          aria-label={stickyOn ? 'Unpin sticky' : 'Pin as sticky'}
          title={stickyOn
            ? 'Unpin sticky note'
            : 'Pin as floating sticky note'}
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
      {#if showProperties}
        <PropertiesMenu body={activeBody} onChange={onBodyChange} />
      {/if}
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

  .toolbar-trailing {
    gap: 4px;
  }
</style>
