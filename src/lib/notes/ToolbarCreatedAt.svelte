<script>
  import { slide } from 'svelte/transition';
  import Icon from '$lib/components/Icon.svelte';
  import './toolbarShared.css';

  const createdAtSlide = { axis: 'x', duration: 180 };

  /** @type {{
   *   editing: boolean,
   *   draftDate: string,
   *   onDraftDateChange: (value: string) => void,
   *   onOpen: () => void,
   *   onCancel: () => void,
   *   onApply: () => void,
   *   onAttachReset: () => void,
   * }} */
  let {
    editing,
    draftDate,
    onDraftDateChange,
    onOpen,
    onCancel,
    onApply,
    onAttachReset,
  } = $props();
</script>

{#if editing}
  <div
    class="created-at-editor flex items-center flex-shrink-0"
    transition:slide={createdAtSlide}
  >
    <input
      class="created-at-input"
      type="date"
      value={draftDate}
      oninput={(e) => onDraftDateChange(e.currentTarget.value)}
      aria-label="Creation date"
    />
    <button type="button" class="toolbar-btn" onclick={onCancel}>Cancel</button>
    <button type="button" class="toolbar-btn accent" onclick={onApply}>Update</button>
  </div>
{:else}
  <button
    type="button"
    class="toolbar-btn flex-shrink-0 icon-btn"
    aria-label="Set creation date"
    title="Set creation date"
    onclick={onOpen}
    {@attach onAttachReset}
    transition:slide={createdAtSlide}
  >
    <Icon name="CalendarTime" class="calendar-time-icon" />
  </button>
{/if}

<style>
  .created-at-editor {
    gap: 4px;
  }

  .created-at-input {
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

  .created-at-input:focus {
    border-color: #525962;
  }

  .created-at-input::-webkit-calendar-picker-indicator {
    filter: invert(0.7);
    cursor: pointer;
  }
</style>
