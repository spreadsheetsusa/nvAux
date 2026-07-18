<script>
  import { onMount, onDestroy, tick } from 'svelte';
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
  } from './store';
  import { escapeRegExp } from '../utils/escapeRegExp';
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
  let contextMenuX = $state(0);
  let contextMenuY = $state(0);

  let renamingGuid = $state(null);
  let renameValue = $state('');

  /** @type {Map<number | string, string>} */
  const dateLabelCache = new Map();

  function handleClickOutside(event) {
    if (showContextMenu && !event.target.closest('.context-menu')) {
      handleCloseContextMenu();
    }
  }

  onMount(async () => {
    db$ = await db();
    document.addEventListener('click', handleClickOutside);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
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

    const sort = [{ updatedAt: 'desc' }];
    const trimmed = (q || '').trim();
    const pattern = trimmed ? `.*${escapeRegExp(trimmed)}.*` : '';
    const query = trimmed
      ? database.notes.find({
          selector: {
            $or: [
              { name: { $regex: pattern, $options: 'i' } },
              { body: { $regex: pattern, $options: 'i' } },
            ],
          },
          sort,
        })
      : database.notes.find({ sort });

    const subscription = query.$.subscribe((results) => {
      notes = results;
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
      .findOne({
        selector: {
          name: note.name,
        },
      })
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
    showContextMenu = true;
    contextMenuNote = note;
    contextMenuX = event.clientX;
    contextMenuY = event.clientY;
  }

  function handleCloseContextMenu() {
    showContextMenu = false;
    contextMenuNote = null;
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
      cancelRename();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<ul
  id="noteList"
  class="thin-scrollbar flex-shrink-0 border-box"
  onmousedown={() => (isMouseDown = true)}
  onmouseup={() => (isMouseDown = false)}
  style="height: {$noteListHeight}px;"
>
  {#each notes as note (note.guid)}
    <!-- svelte-ignore a11y_mouse_events_have_key_events -->
    <li
      data-guid={note.guid}
      class:selected={selectedGuid === note.guid}
      onclick={() => {
        if (renamingGuid === note.guid) return;
        handleSelectNote(note);
      }}
      onkeydown={() => {
        if (renamingGuid === note.guid) return;
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

{#if showContextMenu}
  <FileListItemContextMenu
    note={contextMenuNote}
    x={contextMenuX}
    y={contextMenuY}
    showOpenInNewWindow={isAppWindowed}
    updatedLabel={$isMobile && contextMenuNote ? formatDate(contextMenuNote.updatedAt) : ''}
    ondelete={handleDeleteNote}
    onrename={handleRename}
    onclose={handleCloseContextMenu}
    onOpenInNewWindow={handleOpenInNewWindow}
  />
{/if}

<style>
  ul {
    margin: 0 6px 3px 6px;
    padding: 0;
    overflow-y: auto;
    overflow-x: hidden;
    background-color: var(--app-omni-background);
    border-radius: 8px;
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
