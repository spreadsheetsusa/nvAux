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

  import { selectedNote, bodyText, markdownPreview } from './store';

  import { debounce } from '../utils/debounce';
  import { isEmptyObject } from '../utils/isEmptyObject';

  import Settings from './Settings.svelte';

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

  let showPreview = $derived(canPreview && $markdownPreview);

  let previewHtml = $derived(showPreview ? marked.parse($bodyText || '') : '');

  let innerWidth = $state();
  let innerHeight = $state();
</script>

<div
  bind:clientWidth={innerWidth}
  bind:clientHeight={innerHeight}
  class="note-detail relative"
  style="background: var(--app-notedetail-background);"
>
  {#if isEmptyObject($selectedNote)}
    <div class="empty-state">
      <h2 style="font-size: 18px; color: #525962">No Note Selected</h2>
    </div>
  {:else if $selectedNote.guid === SETTINGS_GUID}
    <div class="settings-scroll thin-scrollbar">
      <Settings />
    </div>
  {:else if showPreview}
    <div class="markdown-preview thin-scrollbar">
      {@html previewHtml}
    </div>
  {:else}
    <div class="editor-shell">
      <textarea
        id="body-editor"
        class="body-editor thin-scrollbar block no-resize border-0 outline-none border-box bg-transparent"
        bind:value={$bodyText}
        onkeyup={handleDebounceSave}
      ></textarea>
    </div>
  {/if}
</div>

<style>
  .note-detail {
    display: flex;
    flex-direction: column;
    flex: 1 1 0%;
    min-height: 0;
    margin: 0 6px 35px 6px;
    border-radius: 8px;
    overflow: hidden;
    box-sizing: border-box;
  }

  .empty-state {
    flex: 1 1 0%;
    min-height: 0;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .settings-scroll {
    flex: 1 1 0%;
    min-height: 0;
    overflow-y: auto;
  }

  .editor-shell {
    position: relative;
    flex: 1 1 0%;
    min-height: 0;
    overflow: hidden;
  }

  .body-editor {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow-y: auto;
    field-sizing: fixed;
    padding: 4px 13px;
    color: rgba(255, 255, 255, 0.831);
    font-size: 14px;
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.3;
    border-radius: none;
  }

  .markdown-preview {
    flex: 1 1 0%;
    min-height: 0;
    overflow-y: auto;
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
