<script>
  // @ts-nocheck

  import 'highlight.js/styles/github.css';

  import {
    db,
    closeNotePopup,
    raiseNotePopup,
    updateNotePopupRect,
    setStickyColor,
    openNoteByName,
    STICKY_NOTE_W,
    STICKY_NOTE_H,
    unlockedNoteActivity,
    touchNoteActivity,
  } from '$lib/store';
  import { popupFrame } from '../../utils/popupFrame';
  import {
    parseNoteMeta,
    STICKY_COLORS,
    normalizeStickyColor,
    isNoteLocked,
  } from '$lib/noteTypes/parseNoteMeta';
  import {
    toWikiPreviewMarkdown,
    parseWikiHref,
  } from '../../utils/wikiLinks';
  import NoteUnlockPanel from '$lib/notes/NoteUnlockPanel.svelte';
  import { renderMarkdown } from '$lib/notes/markdownPreview';

  let {
    id,
    guid,
    left = 80,
    top = 80,
    color = 'yellow',
    zIndex = 40,
  } = $props();

  /** @type {any} */
  let noteDoc = $state(null);
  let noteName = $state('');
  let localBody = $state('');
  let missing = $state(false);
  let previewHtml = $state('');

  let stickyColor = $derived(
    normalizeStickyColor(parseNoteMeta(localBody).color ?? color) ?? 'yellow'
  );
  let bodyContent = $derived(parseNoteMeta(localBody).bodyWithoutMeta);
  let contentLocked = $derived(
    !missing && isNoteLocked(localBody) && $unlockedNoteActivity[guid] == null
  );

  $effect(() => {
    const content = bodyContent || '';
    const timeoutId = window.setTimeout(() => {
      previewHtml = renderMarkdown(toWikiPreviewMarkdown(content));
    }, 120);
    return () => window.clearTimeout(timeoutId);
  });

  $effect(() => {
    const g = guid;
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
        localBody = fresh.body ?? '';
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

  function markNoteActivity() {
    touchNoteActivity(guid);
  }

  function handleStickyPointerDown() {
    handleRaise();
    markNoteActivity();
  }

  function handleFrame(rect) {
    updateNotePopupRect(id, rect);
  }

  async function pickColor(next) {
    if (!noteDoc) return;
    await setStickyColor(noteDoc, next);
  }

  function handlePreviewClick(e) {
    const anchor = e.target?.closest?.('a[href^="#wiki:"]');
    if (!anchor) return;
    e.preventDefault();
    const title = parseWikiHref(anchor.getAttribute('href'));
    if (title) openNoteByName(title);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="sticky-note sticky-{stickyColor}"
  use:popupFrame={{
    left,
    top,
    width: STICKY_NOTE_W,
    height: STICKY_NOTE_H,
    resizeEnabled: false,
    onFrame: handleFrame,
  }}
  style:z-index={zIndex}
  onpointerdown={handleStickyPointerDown}
>
  <div class="popup-titlebar sticky-titlebar flex items-center">
    <span class="sticky-title truncate flex-1 min-w-0">{noteName || 'Note'}</span>
    <div class="sticky-colors flex items-center justify-end flex-shrink-0">
      {#each STICKY_COLORS as c (c)}
        <button
          type="button"
          class="sticky-swatch sticky-swatch-{c}"
          class:active={stickyColor === c}
          aria-label={`Sticky color ${c}`}
          title={c}
          onclick={(e) => {
            e.stopPropagation();
            pickColor(c);
          }}
        ></button>
      {/each}
    </div>
    <button
      type="button"
      class="sticky-close bg-transparent flex-shrink-0"
      aria-label="Hide sticky"
      title="Hide for this session"
      onclick={handleClose}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  </div>

  <div class="sticky-body thin-scrollbar flex-1 min-h-0 overflow-y-auto">
    {#if missing}
      <p class="sticky-empty">Note not found</p>
    {:else if contentLocked}
      <div class="sticky-locked">
        <NoteUnlockPanel {guid} variant="sticky" />
      </div>
    {:else}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="sticky-preview" onclick={handlePreviewClick}>
        {@html previewHtml}
      </div>
    {/if}
  </div>
</div>

<style>
  .sticky-note {
    position: fixed;
    display: flex;
    flex-direction: column;
    border-radius: 2px;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.12),
      0 10px 28px -12px rgba(0, 0, 0, 0.35);
    overflow: hidden;
    touch-action: none;
    margin: 0;
    max-width: none;
    color: #1f2937;
  }

  .sticky-yellow {
    background: var(--sticky-yellow);
  }
  .sticky-pink {
    background: var(--sticky-pink);
  }
  .sticky-blue {
    background: var(--sticky-blue);
  }

  .sticky-titlebar {
    position: relative;
    flex-shrink: 0;
    height: 32px;
    padding: 0 4px 0 10px;
    gap: 4px;
    cursor: move;
    background: color-mix(in srgb, #000 6%, transparent);
    border-bottom: 1px solid color-mix(in srgb, #000 8%, transparent);
  }

  .sticky-title {
    font-size: 12px;
    font-weight: 600;
    color: #111827;
    line-height: 1.2;
    pointer-events: none;
  }

  .sticky-colors {
    position: absolute;
    right: 28px;
    top: 50%;
    transform: translateY(-50%);
    gap: 4px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms ease;
    justify-content: flex-end;
    padding: 2px 4px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--sticky-yellow) 70%, #fff);
  }

  .sticky-note.sticky-pink .sticky-colors {
    background: color-mix(in srgb, var(--sticky-pink) 70%, #fff);
  }

  .sticky-note.sticky-blue .sticky-colors {
    background: color-mix(in srgb, var(--sticky-blue) 70%, #fff);
  }

  .sticky-titlebar:hover .sticky-colors,
  .sticky-titlebar:focus-within .sticky-colors {
    opacity: 1;
    pointer-events: auto;
  }

  .sticky-swatch {
    width: 12px;
    height: 12px;
    padding: 0;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, #000 22%, transparent);
    cursor: pointer;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
  }

  .sticky-swatch-yellow {
    background: var(--sticky-yellow);
  }
  .sticky-swatch-pink {
    background: var(--sticky-pink);
  }
  .sticky-swatch-blue {
    background: var(--sticky-blue);
  }

  .sticky-swatch.active {
    outline: 2px solid color-mix(in srgb, #000 45%, transparent);
    outline-offset: 1px;
  }

  .sticky-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 3px;
    color: color-mix(in srgb, #111827 55%, transparent);
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .sticky-titlebar:hover .sticky-close,
  .sticky-titlebar:focus-within .sticky-close {
    opacity: 1;
  }

  .sticky-close:hover {
    color: #111827;
    background: color-mix(in srgb, #000 8%, transparent);
  }

  .sticky-body {
    padding: 8px 10px 10px;
  }

  .sticky-empty {
    margin: 0;
    font-size: 12px;
    opacity: 0.55;
  }

  .sticky-locked {
    min-height: 100%;
    display: flex;
  }

  .sticky-preview {
    font-size: 12px;
    line-height: 1.45;
    word-break: break-word;
  }

  .sticky-preview :global(h1),
  .sticky-preview :global(h2),
  .sticky-preview :global(h3) {
    margin: 0 0 0.4em;
    font-size: 13px;
    line-height: 1.3;
  }

  .sticky-preview :global(p) {
    margin: 0 0 0.55em;
  }

  .sticky-preview :global(ul),
  .sticky-preview :global(ol) {
    margin: 0 0 0.55em;
    padding-left: 1.2em;
  }

  .sticky-preview :global(a) {
    color: #1d4ed8;
  }

  .sticky-preview :global(pre) {
    margin: 0 0 0.55em;
    padding: 6px;
    border-radius: 3px;
    background: color-mix(in srgb, #000 8%, transparent);
    overflow-x: auto;
    font-size: 11px;
  }

  .sticky-preview :global(code) {
    font-size: 11px;
  }
</style>
