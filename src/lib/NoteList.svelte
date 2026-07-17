<script>
  import { onMount, onDestroy } from 'svelte';
  import { formatDistanceToNow } from 'date-fns';

  import { selectedNote, bodyText, db, omniText, noteListHeight } from './store';
  import FileListItemContextMenu from './FileListItemContextMenu.svelte';

  let db$ = $state(null);
  let isMouseDown = $state(false);
  let notes = $state([]);

  let showContextMenu = $state(false);
  let contextMenuNote = $state(null);
  let contextMenuX = $state(0);
  let contextMenuY = $state(0);

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

  $effect(() => {
    const database = db$;
    const queryText = $omniText;

    if (!database) return;

    const subscription = database.notes
      .find({
        selector: {
          $or: [
            { name: { $regex: `.*${queryText}.*` } },
            { body: { $regex: `.*${queryText}.*` } },
          ],
        },
        sort: [{ updatedAt: 'desc' }],
      })
      .$.subscribe((results) => {
        notes = results;
      });

    return () => subscription.unsubscribe();
  });

  const formatDate = (str) => formatDistanceToNow(new Date(str).getTime(), { addSuffix: true });
  const handleSelectNoteMouseOver = (note) => isMouseDown && handleSelectNote(note);

  const handleDeleteNote = async (noteToDelete) => {
    const database = await db();
    await database.notes.findOne({ selector: { guid: noteToDelete.guid } }).remove();
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
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<ul
  id="noteList"
  class="thin-scrollbar"
  onmousedown={() => (isMouseDown = true)}
  onmouseup={() => (isMouseDown = false)}
  style="height: {$noteListHeight}px;"
>
  {#each notes as note (note.guid)}
    <!-- svelte-ignore a11y_mouse_events_have_key_events -->
    <li
      data-guid={note.guid}
      class:selected={selectedGuid === note.guid}
      onclick={() => handleSelectNote(note)}
      onkeydown={() => handleSelectNote(note)}
      onmouseover={() => handleSelectNoteMouseOver(note)}
      style={selectedGuid === note.guid && 'background: #2252a0; color: white;'}
    >
      <span
        class="elipsis"
        role="button"
        aria-label="Note Preview"
        tabindex="-1"
        ondblclick={() => {
          const bodyEditor = document.getElementById('body-editor');
          if (bodyEditor instanceof HTMLTextAreaElement) {
            bodyEditor.focus();
            const len = bodyEditor.value.length;
            bodyEditor.setSelectionRange(len, len);
          }
        }}
      >
        {note.name}
        {#if note.body !== ''}<span style="color: #505050">—</span>{/if}
        <span class="mute" style={selectedGuid === note.guid && 'color: #fff;'}>
          {note.body ?? ''}
        </span>
      </span>

      <span class="meta flex items-center" style={selectedGuid === note.guid && 'background: #2252a0; color: white;'}>
        {formatDate(note.updatedAt)}
        <button
          type="button"
          aria-label="Note options"
          onclick={(event) => handleContextMenu(event, note)}
          class="bg-transparent flex items-center"
          style="margin-left: 5px; color: {selectedGuid === note.guid ? '#ffffff42' : '#7e848c66'};"
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
    ondelete={handleDeleteNote}
    onclose={() => (showContextMenu = false)}
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
    box-sizing: border-box;
    flex-shrink: 0;
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
    white-space: nowrap;
    text-align: right;
    font-size: 13px;
  }
  .mute {
    color: #65676c;
  }
</style>
