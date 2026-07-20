<script>
  import { onMount, tick } from 'svelte';
  import { formatDistanceToNow } from 'date-fns';

  import {
    selectedNote,
    bodyText,
    db,
    omniText,
    noteListHeight,
    fullScreen,
    windowed,
    isMobile,
    openNotePopup,
    invalidateWikiNoteNames,
    noteMatchesQuery,
  } from '$lib/store';
  import { isNoteLocked } from '$lib/noteTypes/parseNoteMeta';
  import FileListItemContextMenu from './FileListItemContextMenu.svelte';

  const BODY_PREVIEW_LEN = 100;
  const SEARCH_DEBOUNCE_MS = 150;

  let isAppWindowed = $derived($fullScreen && $windowed && !$isMobile);

  let db$ = $state(null);
  let isMouseDown = $state(false);
  /** @type {any[]} */
  let notes = $state.raw([]);
  /** Debounced Omnibar text used for the RxDB subscription. */
  let queryText = $state('');

  let showContextMenu = $state(false);
  let contextMenuNote = $state(null);
  /** @type {{ left: number, top: number, right: number, bottom: number, width: number, height: number } | null} */
  let contextMenuAnchor = $state(null);

  let renamingGuid = $state(null);
  let renameValue = $state('');

  /** @type {Map<number | string, string>} */
  const dateLabelCache = new Map();

  onMount(async () => {
    db$ = await db();
  });

  // Debounce Omnibar → query (input stays immediate; RxDB resubscribes after pause).
  $effect(() => {
    const text = $omniText;
    const timeoutId = window.setTimeout(() => {
      queryText = text;
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  });

  $effect(() => {
    const database = db$;
    const q = queryText;

    if (!database) return;

    // Encrypted name/body cannot be used in IndexedDB selectors — filter in memory.
    const query = database.notes.find({ sort: [{ updatedAt: 'desc' }] });
    const subscription = query.$.subscribe((results) => {
      notes = (q || '').trim()
        ? results.filter((n) => noteMatchesQuery(n, q))
        : results;
    });

    return () => subscription.unsubscribe();
  });

  const formatDate = (str) => {
    const cached = dateLabelCache.get(str);
    if (cached) return cached;
    const label = formatDistanceToNow(new Date(str).getTime(), { addSuffix: true });
    dateLabelCache.set(str, label);
    return label;
  };

  /** @param {string | null | undefined} body */
  const bodyPreview = (body) => {
    if (!body) return '';
    if (isNoteLocked(body)) return '🔒 Locked';
    return body.length > BODY_PREVIEW_LEN ? body.slice(0, BODY_PREVIEW_LEN) : body;
  };

  const handleSelectNoteMouseOver = (note) => isMouseDown && handleSelectNote(note);

  const handleDeleteNote = async (noteToDelete) => {
    const database = await db();
    await database.notes.findOne({ selector: { guid: noteToDelete.guid } }).remove();
    invalidateWikiNoteNames();
    notes = notes.filter((n) => n.guid !== noteToDelete.guid);
    showContextMenu = false;
  };

  const handleSelectNote = (note) => {
    selectedNote.set(note);
    db$.notes
      .findOne(note.guid)
      .exec()
      .then((n) => {
        bodyText.set(n?.body);
      });
  };

  let selectedGuid = $derived($selectedNote?.guid);

  $effect(() => {
    const guid = selectedGuid;
    if (!guid) return;
    // Wait for list paint (e.g. after external selectNoteByGuid)
    requestAnimationFrame(() => {
      document
        .querySelector(`#noteList [data-guid="${CSS.escape(guid)}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  });

  function handleContextMenu(event, note) {
    event.preventDefault();
    event.stopPropagation();
    // Toggle closed if this note's menu is already open (pointerdown dismiss
    // would otherwise race and reopen on the subsequent click).
    if (showContextMenu && contextMenuNote?.guid === note?.guid) {
      handleCloseContextMenu();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    showContextMenu = true;
    contextMenuNote = note;
    contextMenuAnchor = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }

  function handleCloseContextMenu() {
    showContextMenu = false;
    contextMenuNote = null;
    contextMenuAnchor = null;
  }

  function handleCloseNote(note) {
    if (note?.guid && $selectedNote?.guid === note.guid) {
      selectedNote.set({});
      bodyText.set('');
    }
    handleCloseContextMenu();
  }

  function handleOpenInNewWindow(note) {
    if (!note?.guid) return;
    openNotePopup(note.guid);
    handleCloseContextMenu();
  }

  function cancelRename() {
    renamingGuid = null;
    renameValue = '';
  }

  async function handleRename(note) {
    if (!note?.guid) return;
    handleCloseContextMenu();
    renamingGuid = note.guid;
    renameValue = note.name ?? '';
    if (selectedGuid !== note.guid) {
      handleSelectNote(note);
    }
    await tick();
    const input = document.querySelector('#noteList input.rename-input');
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  }

  let renameSubmitting = false;

  async function submitRename() {
    const guid = renamingGuid;
    if (!guid || renameSubmitting) return;
    renameSubmitting = true;

    try {
      const trimmed = renameValue.trim();
      const note = notes.find((n) => n.guid === guid);
      if (!trimmed || !note || trimmed === note.name) {
        cancelRename();
        return;
      }

      await note.incrementalModify((data) => {
        data.name = trimmed;
        data.updatedAt = new Date().getTime();
        return data;
      });
      invalidateWikiNoteNames();

      if ($selectedNote?.guid === guid) {
        selectedNote.set(note);
      }

      cancelRename();
    } catch (err) {
      console.error('Failed to rename note:', err);
      cancelRename();
    } finally {
      renameSubmitting = false;
    }
  }

  function handleRenameKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelRename();
    }
  }

  function focusOmniCaretEnd() {
    const input = document.getElementById('omni-input');
    if (!(input instanceof HTMLInputElement)) return;
    input.dataset.focusCaretEnd = '1';
    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }

  function focusNoteList() {
    document.getElementById('noteList')?.focus();
  }

  /** @param {KeyboardEvent} event */
  function handleNoteListKeydown(event) {
    if (renamingGuid) return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest('input, button, textarea, [contenteditable="true"]')
    ) {
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (notes.length === 0) return;

    event.preventDefault();

    const currentIndex = selectedGuid
      ? notes.findIndex((n) => n.guid === selectedGuid)
      : -1;

    if (event.key === 'ArrowDown') {
      const nextIndex =
        currentIndex < 0 ? 0 : Math.min(currentIndex + 1, notes.length - 1);
      if (nextIndex !== currentIndex) {
        handleSelectNote(notes[nextIndex]);
      }
      return;
    }

    // ArrowUp — leave list for Omnibar when already on (or above) the first item
    if (currentIndex <= 0) {
      focusOmniCaretEnd();
      return;
    }
    handleSelectNote(notes[currentIndex - 1]);
  }
</script>

<ul
  id="noteList"
  class="thin-scrollbar flex-shrink-0 border-box"
  class:is-collapsed={$noteListHeight <= 0}
  role="listbox"
  aria-label="Notes"
  tabindex="0"
  onmousedown={() => (isMouseDown = true)}
  onmouseup={() => (isMouseDown = false)}
  onkeydown={handleNoteListKeydown}
  style="height: {$noteListHeight}px;"
>
  {#each notes as note (note.guid)}
    <!-- svelte-ignore a11y_mouse_events_have_key_events -->
    <li
      data-guid={note.guid}
      role="option"
      aria-selected={selectedGuid === note.guid}
      class:selected={selectedGuid === note.guid}
      onclick={() => {
        if (renamingGuid === note.guid) return;
        handleSelectNote(note);
        focusNoteList();
      }}
      onkeydown={(e) => {
        if (renamingGuid === note.guid) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        handleSelectNote(note);
      }}
      onmouseover={() => handleSelectNoteMouseOver(note)}
      style={selectedGuid === note.guid && 'background: #2252a0; color: white;'}
    >
      <span
        class="elipsis min-w-0 flex-grow"
        role="button"
        aria-label="Note Preview"
        tabindex="-1"
        ondblclick={() => {
          if (renamingGuid === note.guid) return;
          if (isAppWindowed) {
            handleOpenInNewWindow(note);
            return;
          }
          const bodyEditor = document.getElementById('body-editor');
          if (bodyEditor instanceof HTMLTextAreaElement) {
            bodyEditor.focus();
            const len = bodyEditor.value.length;
            bodyEditor.setSelectionRange(len, len);
          }
        }}
      >
        {#if renamingGuid === note.guid}
          <input
            class="rename-input min-w-0 outline-none bg-transparent"
            bind:value={renameValue}
            onkeydown={handleRenameKeydown}
            onblur={submitRename}
            onclick={(event) => event.stopPropagation()}
            onmousedown={(event) => event.stopPropagation()}
            aria-label="Rename note"
          />
        {:else}
          {note.name}
          {#if note.body}<span style="color: #505050">—</span>{/if}
          <span class="mute" style={selectedGuid === note.guid && 'color: #fff;'}>
            {bodyPreview(note.body)}
          </span>
        {/if}
      </span>

      <span class="meta flex items-center flex-shrink-0" style={selectedGuid === note.guid && 'background: #2252a0; color: white;'}>
        {#if !$isMobile}
          <span class="truncate">{formatDate(note.updatedAt)}</span>
        {/if}
        <button
          type="button"
          aria-label="Note options"
          onpointerdown={(event) => event.stopPropagation()}
          onclick={(event) => handleContextMenu(event, note)}
          class="note-options bg-transparent flex items-center flex-shrink-0"
          style="margin-left: 5px; color: {selectedGuid === note.guid ? '#ffffffa0' : '#7e848c'};"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-more-vertical"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
        </button>
      </span>
    </li>
  {/each}
</ul>

{#if showContextMenu && contextMenuAnchor}
  <FileListItemContextMenu
    note={contextMenuNote}
    anchorRect={contextMenuAnchor}
    showOpenInNewWindow={isAppWindowed}
    updatedLabel={$isMobile && contextMenuNote ? formatDate(contextMenuNote.updatedAt) : ''}
    ondelete={handleDeleteNote}
    onrename={handleRename}
    onclose={handleCloseContextMenu}
    onCloseNote={handleCloseNote}
    onOpenInNewWindow={handleOpenInNewWindow}
  />
{/if}

<style>
  ul {
    margin: 0;
    padding: 0;
    overflow-y: auto;
    overflow-x: hidden;
    background-color: var(--app-omni-background);
  }
  ul:focus {
    outline: none;
  }
  ul.is-collapsed {
    margin: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }
  li {
    display: flex;
    align-items: center;
    font-size: 14px;
    height: 35px;
    padding: 10px;
    justify-content: space-between;
    font-family: Helvetica, sans-serif;
    user-select: none;
    box-sizing: border-box;
    color: rgb(205, 205, 205);
  }
  li:nth-child(odd) {
    background: var(--app-notelist-odd-background);
  }
  li:nth-child(even) {
    background: var(--app-notelist-even-background);
  }
  .meta {
    color: #43484f;
    text-align: right;
    font-size: 13px;
    max-width: 45%;
  }
  .note-options {
    width: 16px;
    height: 16px;
    justify-content: center;
  }
  .mute {
    color: #65676c;
  }
  .rename-input {
    display: block;
    font: inherit;
    color: inherit;
    border: none;
    padding: 0;
    margin: 0;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }
</style>
