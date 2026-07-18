<script>
  // @ts-nocheck

  import { Marked } from 'marked';
  import { markedHighlight } from 'marked-highlight';
  import hljs from 'highlight.js/lib/core';
  import bash from 'highlight.js/lib/languages/bash';
  import c from 'highlight.js/lib/languages/c';
  import cpp from 'highlight.js/lib/languages/cpp';
  import css from 'highlight.js/lib/languages/css';
  import go from 'highlight.js/lib/languages/go';
  import java from 'highlight.js/lib/languages/java';
  import javascript from 'highlight.js/lib/languages/javascript';
  import json from 'highlight.js/lib/languages/json';
  import markdown from 'highlight.js/lib/languages/markdown';
  import plaintext from 'highlight.js/lib/languages/plaintext';
  import python from 'highlight.js/lib/languages/python';
  import rust from 'highlight.js/lib/languages/rust';
  import sql from 'highlight.js/lib/languages/sql';
  import typescript from 'highlight.js/lib/languages/typescript';
  import xml from 'highlight.js/lib/languages/xml';
  import yaml from 'highlight.js/lib/languages/yaml';
  import 'highlight.js/styles/github-dark.css';

  import {
    selectedNote,
    bodyText,
    markdownPreview,
    db,
    openNoteByName,
    showStatusBar,
  } from './store';

  import { debounce } from '../utils/debounce';
  import { isEmptyObject } from '../utils/isEmptyObject';
  import {
    getOpenWikiQuery,
    toWikiPreviewMarkdown,
    parseWikiHref,
    filterWikiSuggestions,
    applyWikiCompletion,
    getTextareaCaretOffset,
  } from '../utils/wikiLinks';

  import Settings from './Settings.svelte';
  import WikiLinkSuggest from './WikiLinkSuggest.svelte';
  import NoteToolbar from './NoteToolbar.svelte';

  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('c', c);
  hljs.registerLanguage('cpp', cpp);
  hljs.registerLanguage('css', css);
  hljs.registerLanguage('go', go);
  hljs.registerLanguage('java', java);
  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('json', json);
  hljs.registerLanguage('markdown', markdown);
  hljs.registerLanguage('plaintext', plaintext);
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('rust', rust);
  hljs.registerLanguage('sql', sql);
  hljs.registerLanguage('typescript', typescript);
  hljs.registerLanguage('xml', xml);
  hljs.registerLanguage('yaml', yaml);

  const marked = new Marked(
    markedHighlight({
      emptyLangClass: 'hljs',
      langPrefix: 'hljs language-',
      highlight(code, lang) {
        const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      },
    })
  );

  const SETTINGS_GUID = '00000000-0000-0000-0000-000000000000';

  const handleDebounceSave = debounce(() => updateNote(), 300);

  const updateNote = async () => {
    // @ts-ignore
    await $selectedNote?.incrementalModify((data) => {
      data.body = $bodyText;
      data.updatedAt = new Date().getTime();
      return data;
    });
  };

  let canPreview = $derived(
    !!$selectedNote &&
      !isEmptyObject($selectedNote) &&
      $selectedNote.guid !== SETTINGS_GUID
  );

  $effect(() => {
    if (!canPreview && $markdownPreview) {
      markdownPreview.set(false);
    }
  });

  let showPreview = $derived(canPreview && $markdownPreview);

  let previewHtml = $derived(
    showPreview ? marked.parse(toWikiPreviewMarkdown($bodyText || '')) : ''
  );

  let innerWidth = $state();
  let innerHeight = $state();

  /** @type {HTMLTextAreaElement | undefined} */
  let editorEl = $state();

  let wikiVisible = $state(false);
  let wikiStart = $state(0);
  /** @type {string[]} */
  let wikiCandidates = $state([]);
  let wikiSelectedIndex = $state(0);
  let wikiLeft = $state(0);
  let wikiTop = $state(0);

  /** Cached note titles while an open [[…]] span is active. */
  /** @type {string[] | null} */
  let wikiNameCache = null;
  let wikiSyncSeq = 0;

  function dismissWikiSuggest() {
    wikiSyncSeq += 1;
    wikiVisible = false;
    wikiCandidates = [];
    wikiSelectedIndex = 0;
    wikiNameCache = null;
  }

  async function ensureWikiNameCache() {
    if (wikiNameCache) return wikiNameCache;
    const database = await db();
    const docs = await database.notes.find().exec();
    wikiNameCache = docs.map((n) => n.name).filter(Boolean);
    return wikiNameCache;
  }

  async function syncWikiSuggest() {
    if (!editorEl || showPreview) {
      dismissWikiSuggest();
      return;
    }

    const cursor = editorEl.selectionStart ?? 0;
    const open = getOpenWikiQuery($bodyText || '', cursor);
    if (!open) {
      dismissWikiSuggest();
      return;
    }

    const seq = ++wikiSyncSeq;
    wikiStart = open.start;

    const names = await ensureWikiNameCache();
    if (seq !== wikiSyncSeq) return;

    wikiCandidates = filterWikiSuggestions(names, open.query);
    wikiSelectedIndex = 0;

    if (wikiCandidates.length === 0) {
      wikiVisible = false;
      return;
    }

    const caret = getTextareaCaretOffset(editorEl, cursor);
    const shell = editorEl.parentElement;
    const shellRect = shell?.getBoundingClientRect();
    const editorRect = editorEl.getBoundingClientRect();
    const offsetLeft = editorRect.left - (shellRect?.left ?? editorRect.left);
    const offsetTop = editorRect.top - (shellRect?.top ?? editorRect.top);

    wikiLeft = Math.max(8, offsetLeft + caret.left);
    wikiTop = Math.max(8, offsetTop + caret.top + caret.height + 4);
    wikiVisible = true;
  }

  function acceptWikiSuggestion(name) {
    if (!editorEl || !name) return;
    const cursor = editorEl.selectionStart ?? 0;
    const { text, cursor: nextCursor } = applyWikiCompletion(
      $bodyText || '',
      wikiStart,
      cursor,
      name
    );
    bodyText.set(text);
    dismissWikiSuggest();
    queueMicrotask(() => {
      if (!editorEl) return;
      editorEl.focus();
      editorEl.setSelectionRange(nextCursor, nextCursor);
      handleDebounceSave();
    });
  }

  function handleEditorInput() {
    handleDebounceSave();
    syncWikiSuggest();
  }

  function handleEditorKeyup(e) {
    if (
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'Home' ||
      e.key === 'End'
    ) {
      syncWikiSuggest();
    }
  }

  function handleEditorKeydown(e) {
    if (!wikiVisible || wikiCandidates.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      wikiSelectedIndex = (wikiSelectedIndex + 1) % wikiCandidates.length;
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      wikiSelectedIndex =
        (wikiSelectedIndex - 1 + wikiCandidates.length) % wikiCandidates.length;
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      acceptWikiSuggestion(wikiCandidates[wikiSelectedIndex]);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      dismissWikiSuggest();
    }
  }

  function handleEditorClick() {
    syncWikiSuggest();
  }

  function handleEditorBlur() {
    // Delay so mousedown on a suggestion can fire first.
    setTimeout(() => dismissWikiSuggest(), 150);
  }

  function handlePreviewClick(e) {
    const anchor = e.target?.closest?.('a[href^="#wiki:"]');
    if (!anchor) return;
    e.preventDefault();
    const title = parseWikiHref(anchor.getAttribute('href'));
    if (title) openNoteByName(title);
  }
</script>

<div
  bind:clientWidth={innerWidth}
  bind:clientHeight={innerHeight}
  class="note-detail relative flex flex-col flex-1 min-h-0 overflow-hidden border-box"
  style="background: var(--app-notedetail-background); margin-bottom: {$showStatusBar ? '35px' : '0'};"
>
  {#if isEmptyObject($selectedNote)}
    <div class="empty-state flex-1 min-h-0 w-full flex items-center justify-center">
      <h2 style="font-size: 18px; color: #525962">No Note Selected</h2>
    </div>
  {:else if $selectedNote.guid === SETTINGS_GUID}
    <div class="settings-scroll thin-scrollbar flex-1 min-h-0 overflow-y-auto">
      <Settings />
    </div>
  {:else}
    <NoteToolbar />
    {#if showPreview}
      <!-- Event delegation for [[wiki]] anchors inside {@html} preview -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="markdown-preview thin-scrollbar flex-1 min-h-0 overflow-y-auto"
        onclick={handlePreviewClick}
      >
        {@html previewHtml}
      </div>
    {:else}
      <div class="editor-shell relative flex-1 min-h-0 overflow-hidden">
        <textarea
          id="body-editor"
          bind:this={editorEl}
          class="body-editor thin-scrollbar absolute inset-0 w-full h-full overflow-y-auto block no-resize border-0 outline-none border-box bg-transparent"
          bind:value={$bodyText}
          oninput={handleEditorInput}
          onkeydown={handleEditorKeydown}
          onkeyup={handleEditorKeyup}
          onclick={handleEditorClick}
          onblur={handleEditorBlur}
        ></textarea>
        <WikiLinkSuggest
          candidates={wikiCandidates}
          selectedIndex={wikiSelectedIndex}
          left={wikiLeft}
          top={wikiTop}
          visible={wikiVisible}
          onSelect={acceptWikiSuggestion}
          onHover={(i) => {
            wikiSelectedIndex = i;
          }}
        />
      </div>
    {/if}
  {/if}
</div>

<style>
  .note-detail {
    margin-top: 0;
    margin-left: 6px;
    margin-right: 6px;
    border-radius: 8px;
    /* Safety: never collapse away when the note list was left tall */
    min-height: 120px;
  }

  .body-editor {
    field-sizing: fixed;
    padding: 4px 13px;
    color: rgba(255, 255, 255, 0.831);
    font-size: 14px;
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.3;
    border-radius: none;
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

  .markdown-preview :global(li) {
    margin: 0.2em 0;
  }

  .markdown-preview :global(a) {
    color: #7eb8ff;
    text-decoration: underline;
  }

  .markdown-preview :global(blockquote) {
    margin-left: 0;
    padding: 0.25em 0 0.25em 0.85em;
    border-left: 3px solid #525962;
    color: rgba(255, 255, 255, 0.65);
  }

  /* Inline code only — fenced blocks use hljs token colors */
  .markdown-preview :global(:not(pre) > code) {
    font-family: Consolas, 'Courier New', monospace;
    font-size: 0.9em;
    padding: 0.1em 0.35em;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.08);
  }

  .markdown-preview :global(pre) {
    padding: 0;
    border-radius: 4px;
    overflow-x: auto;
    background: transparent;
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

  .markdown-preview :global(pre),
  .markdown-preview :global(pre code.hljs) {
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) transparent;
  }

  .markdown-preview :global(pre::-webkit-scrollbar),
  .markdown-preview :global(pre code.hljs::-webkit-scrollbar) {
    width: 6px;
    height: 6px;
  }

  .markdown-preview :global(pre::-webkit-scrollbar-thumb),
  .markdown-preview :global(pre code.hljs::-webkit-scrollbar-thumb) {
    background-color: var(--scrollbar-thumb);
    border-radius: 999px;
  }

  .markdown-preview :global(hr) {
    margin: 1em 0;
    border: none;
    border-top: 1px solid #525962;
  }

  .markdown-preview :global(table) {
    width: 100%;
    margin: 0 0 0.75em;
    border-collapse: collapse;
  }

  .markdown-preview :global(th),
  .markdown-preview :global(td) {
    padding: 0.35em 0.5em;
    border: 1px solid #525962;
  }

  .markdown-preview :global(th) {
    background: rgba(255, 255, 255, 0.06);
  }
</style>
