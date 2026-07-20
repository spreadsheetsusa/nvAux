<script>
  // @ts-nocheck

  import 'highlight.js/styles/github-dark.css';

  import {
    db,
    markdownPreview,
    closeNotePopup,
    raiseNotePopup,
    updateNotePopupRect,
    openNoteByName,
    syncMarkdownPreviewForNoteType,
    unlockedNoteActivity,
    touchNoteActivity,
    SETTINGS_GUID,
  } from '$lib/store';
  import { popupFrame } from '../../utils/popupFrame';
  import { debounce } from '../../utils/debounce';
  import {
    toWikiPreviewMarkdown,
    parseWikiHref,
  } from '../../utils/wikiLinks';
  import Settings from '$lib/settings/Settings.svelte';
  import NoteToolbar from '$lib/notes/NoteToolbar.svelte';
  import NoteUnlockPanel from '$lib/notes/NoteUnlockPanel.svelte';
  import { renderMarkdown } from '$lib/notes/markdownPreview';
  import { isNoteLocked } from '$lib/noteTypes/parseNoteMeta';
  import { resolveNoteType } from '$lib/noteTypes/resolveNoteType';
  import KanbanBoard from '$lib/noteTypes/kanban/KanbanBoard.svelte';
  import MusicDaw from '$lib/noteTypes/music/MusicDaw.svelte';


  let {
    id,
    guid,
    left = 80,
    top = 80,
    width = 420,
    height = 320,
    zIndex = 40,
  } = $props();

  /** @type {any} */
  let noteDoc = $state(null);
  let noteName = $state('');
  let localBody = $state('');
  let missing = $state(false);

  const handleDebounceSave = debounce(() => updateNote(), 300);

  const updateNote = async () => {
    if (!noteDoc || noteDoc.guid === SETTINGS_GUID) return;
    try {
      await noteDoc.incrementalModify((data) => {
        data.body = localBody;
        data.updatedAt = new Date().getTime();
        return data;
      });
    } catch (err) {
      console.error('Failed to save popup note body:', err);
    }
  };

  let isSettings = $derived(guid === SETTINGS_GUID);
  let contentLocked = $derived(
    !isSettings &&
      !missing &&
      isNoteLocked(localBody) &&
      $unlockedNoteActivity[guid] == null
  );
  let showPreview = $derived(!isSettings && !missing && $markdownPreview);
  let noteType = $derived(resolveNoteType(noteDoc ?? { guid }, localBody));
  let showMarkdownPreview = $derived(showPreview && noteType === 'markdown');
  let showKanban = $derived(showPreview && noteType === 'kanban');
  let showMusic = $derived(showPreview && noteType === 'music');

  $effect(() => {
    if (isSettings || missing) return;
    syncMarkdownPreviewForNoteType(noteType);
  });

  let previewHtml = $state('');

  $effect(() => {
    if (!showMarkdownPreview) {
      previewHtml = '';
      return;
    }
    const body = localBody || '';
    const timeoutId = window.setTimeout(() => {
      previewHtml = renderMarkdown(toWikiPreviewMarkdown(body));
    }, 150);
    return () => window.clearTimeout(timeoutId);
  });

  function handleBodyChange(nextBody) {
    localBody = nextBody;
    handleDebounceSave();
  }

  let editorId = $derived(`body-editor-popup-${guid}`);

  $effect(() => {
    const g = guid;
    const editorDomId = `body-editor-popup-${g}`;
    let cancelled = false;
    /** @type {{ unsubscribe?: () => void } | null} */
    let sub = null;

    (async () => {
      const database = await db();
      if (cancelled) return;
      const doc = await database.notes.findOne(g).exec();
      if (cancelled) return;
      if (!doc) {
        missing = true;
        noteDoc = null;
        noteName = 'Missing note';
        localBody = '';
        return;
      }
      missing = false;
      noteDoc = doc;
      noteName = doc.name ?? '';
      localBody = doc.body ?? '';

      sub = doc.$.subscribe((fresh) => {
        if (!fresh) {
          missing = true;
          return;
        }
        noteName = fresh.name ?? '';
        // Avoid clobbering in-progress typing from our own saves.
        if (document.activeElement?.id !== editorDomId) {
          localBody = fresh.body ?? '';
        }
        noteDoc = fresh;
      });
    })();

    return () => {
      cancelled = true;
      sub?.unsubscribe?.();
    };
  });

  function handleClose(event) {
    event?.stopPropagation?.();
    closeNotePopup(id);
  }

  function handleRaise() {
    raiseNotePopup(id);
  }

  function handleFrame(rect) {
    updateNotePopupRect(id, rect);
  }

  function handlePreviewClick(e) {
    const anchor = e.target?.closest?.('a[href^="#wiki:"]');
    if (!anchor) return;
    e.preventDefault();
    const title = parseWikiHref(anchor.getAttribute('href'));
    if (title) openNoteByName(title);
  }

  function markNoteActivity() {
    touchNoteActivity(guid);
  }

  function handlePopupPointerDown() {
    handleRaise();
    markNoteActivity();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- style:z-index only — a full style="…" attr would wipe popupFrame geometry -->
<div
  class="note-popup"
  use:popupFrame={{ left, top, width, height, onFrame: handleFrame }}
  style:z-index={zIndex}
  onpointerdown={handlePopupPointerDown}
  onkeydown={markNoteActivity}
>
  <div class="popup-titlebar flex items-center justify-between">
    <span class="popup-title truncate">{noteName || 'Note'}</span>
    <button
      type="button"
      class="popup-close bg-transparent"
      aria-label="Close window"
      onclick={handleClose}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  </div>

  <div class="popup-body thin-scrollbar flex flex-col flex-1 min-h-0 overflow-hidden">
    {#if missing}
      <div class="flex-1 flex items-center justify-center">
        <p style="font-size: 14px; color: #525962">Note not found</p>
      </div>
    {:else if isSettings}
      <div class="settings-scroll thin-scrollbar flex-1 min-h-0 overflow-y-auto">
        <Settings />
      </div>
    {:else}
      <NoteToolbar note={noteDoc} body={localBody} onBodyChange={handleBodyChange} />
      {#if contentLocked}
        <NoteUnlockPanel {guid} />
      {:else if showKanban}
        <KanbanBoard body={localBody} onChange={handleBodyChange} />
      {:else if showMusic}
        <MusicDaw body={localBody} onChange={handleBodyChange} />
      {:else if showMarkdownPreview}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="markdown-preview thin-scrollbar flex-1 min-h-0 overflow-y-auto"
          onclick={handlePreviewClick}
        >
          {@html previewHtml}
        </div>
      {:else}
        <textarea
          id={editorId}
          class="body-editor thin-scrollbar flex-1 min-h-0 w-full h-full overflow-y-auto block no-resize border-0 outline-none border-box bg-transparent"
          bind:value={localBody}
          oninput={handleDebounceSave}
        ></textarea>
      {/if}
    {/if}
  </div>
</div>

<style>
  .note-popup {
    position: fixed;
    display: flex;
    flex-direction: column;
    background: var(--app-background);
    border-radius: 8px;
    border: 1px solid #3a3f412e;
    box-shadow: 0px 24px 48px -18px rgba(0, 0, 0, 0.75);
    overflow: hidden;
    touch-action: none;
    min-width: 280px;
    min-height: 200px;
    /* Avoid flex-parent centering when geometry briefly unset */
    margin: 0;
    max-width: none;
  }

  .popup-titlebar {
    flex-shrink: 0;
    height: 34px;
    padding: 0 8px 0 12px;
    background: var(--app-omni-background);
    border-bottom: 1px solid var(--app-statusbar-border);
    cursor: move;
    user-select: none;
    color: var(--text-color, rgba(255, 255, 255, 0.85));
    font-size: 13px;
    font-family: Helvetica, Arial, sans-serif;
  }

  .popup-title {
    flex: 1;
    min-width: 0;
    pointer-events: none;
  }

  .popup-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    color: #7e848c;
    cursor: pointer;
    flex-shrink: 0;
  }

  .popup-close:hover {
    background: var(--app-notelist-odd-background);
    color: rgba(255, 255, 255, 0.9);
  }

  .popup-body {
    background: var(--app-notedetail-background);
    margin: 6px;
    border-radius: 8px;
  }

  .body-editor {
    field-sizing: fixed;
    padding: 4px 13px;
    color: rgba(255, 255, 255, 0.831);
    font-size: 14px;
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.3;
  }

  .markdown-preview {
    padding: 4px 13px;
    color: rgba(255, 255, 255, 0.831);
    font-size: 14px;
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.5;
  }

  .markdown-preview :global(h1),
  .markdown-preview :global(h2),
  .markdown-preview :global(h3),
  .markdown-preview :global(h4),
  .markdown-preview :global(h5),
  .markdown-preview :global(h6) {
    margin: 0.8em 0 0.4em;
    font-weight: 600;
    line-height: 1.25;
    color: rgba(255, 255, 255, 0.92);
  }

  .markdown-preview :global(h1) {
    font-size: 1.6em;
  }

  .markdown-preview :global(h2) {
    font-size: 1.35em;
  }

  .markdown-preview :global(h3) {
    font-size: 1.15em;
  }

  .markdown-preview :global(p),
  .markdown-preview :global(ul),
  .markdown-preview :global(ol),
  .markdown-preview :global(blockquote),
  .markdown-preview :global(pre) {
    margin: 0 0 0.75em;
  }

  .markdown-preview :global(ul),
  .markdown-preview :global(ol) {
    padding-left: 1.5em;
  }

  .markdown-preview :global(a) {
    color: #7eb8ff;
    text-decoration: underline;
  }

  .markdown-preview :global(pre code.hljs) {
    display: block;
    padding: 0.75em 1em;
    overflow-x: auto;
    border-radius: 4px;
    font-family: Consolas, 'Courier New', monospace;
    font-size: 0.9em;
    line-height: 1.45;
  }

  .settings-scroll {
    padding: 4px 0;
  }
</style>
