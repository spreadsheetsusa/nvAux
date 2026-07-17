<script>
  import { fullScreen, windowed, selectedNote, markdownPreview } from './store';
  import { isEmptyObject } from '../utils/isEmptyObject';

  const SETTINGS_GUID = '00000000-0000-0000-0000-000000000000';

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

  function togglePreview() {
    markdownPreview.update((v) => !v);
  }
</script>

<div
  class="status-bar px-2 items-center flex absolute w-full flex-grow-0 transition-all"
  style="font-size: 12px;  background: var(--app-statusbar-background); bottom: 0; left: 0; color: #606060; border-top: 1px solid var(--app-statusbar-border); height: {$fullScreen && !$windowed ? '45px' : '34px'};"
>
  <div class="flex-grow flex items-center">nvAux v0.1.7-20260716-001</div>
  {#if canPreview}
    <button
      type="button"
      class="preview-toggle flex-shrink-0"
      class:active={$markdownPreview}
      onclick={togglePreview}
    >
      {$markdownPreview ? 'Edit' : 'Preview'}
    </button>
  {/if}
</div>

<style>
  .preview-toggle {
    margin-left: 8px;
    padding: 2px 8px;
    border: 1px solid transparent;
    border-radius: 3px;
    background: transparent;
    color: #606060;
    font-size: 12px;
    line-height: 1.2;
    cursor: pointer;
  }

  .preview-toggle:hover {
    color: #8a8a8a;
    border-color: #404040;
  }

  .preview-toggle.active {
    color: rgba(255, 255, 255, 0.85);
    border-color: #525962;
    background: rgba(255, 255, 255, 0.06);
  }

  @media screen and (max-width: 768px) {
    .status-bar {
      align-items: start;
      padding-top: 10px;
    }
  }

  @media screen and (min-width: 769px) {
    .status-bar {
      align-items: center;
    }
  }
</style>
