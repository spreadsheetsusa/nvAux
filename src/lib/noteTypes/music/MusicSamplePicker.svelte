<script>
  // @ts-nocheck
  import { onMount, onDestroy } from 'svelte';
  import * as Tone from 'tone';
  import { positionFixedMenu } from '../../../utils/positionFixedMenu.js';
  import { SAMPLE_CATEGORIES, filterSamples } from './sampleCatalog';

  let {
    open = false,
    anchorEl = undefined,
    currentUrl = '',
    onSelect,
    onClose,
  } = $props();

  let query = $state('');
  let category = $state('');
  /** @type {HTMLDivElement | undefined} */
  let menuEl = $state();
  /** @type {HTMLInputElement | undefined} */
  let searchEl = $state();
  let previewingId = $state('');

  /** @type {Tone.Player | null} */
  let previewPlayer = null;
  let previewUrl = '';

  let samples = $derived(filterSamples(query, category || undefined));

  function disposePreview() {
    if (previewPlayer) {
      try {
        previewPlayer.dispose();
      } catch {
        /* ignore */
      }
      previewPlayer = null;
    }
    previewUrl = '';
    previewingId = '';
  }

  /** @param {{ id: string, url: string }} sample */
  async function previewSample(sample) {
    try {
      await Tone.start();
      if (previewPlayer && previewUrl === sample.url && previewPlayer.loaded) {
        previewPlayer.stop();
        previewPlayer.start();
        previewingId = sample.id;
        return;
      }
      if (previewPlayer) {
        previewPlayer.dispose();
        previewPlayer = null;
      }
      previewingId = sample.id;
      previewUrl = sample.url;
      const player = new Tone.Player().toDestination();
      previewPlayer = player;
      await player.load(sample.url);
      if (previewPlayer !== player) return;
      player.start();
    } catch {
      previewingId = '';
    }
  }

  function reposition() {
    if (!open || !anchorEl || !menuEl) return;
    positionFixedMenu(anchorEl.getBoundingClientRect(), menuEl);
  }

  /** @param {KeyboardEvent} e */
  function handleKeydown(e) {
    if (e.key !== 'Escape' || !open) return;
    e.preventDefault();
    e.stopPropagation();
    onClose?.();
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
    disposePreview();
  });

  $effect(() => {
    if (!open) {
      query = '';
      category = '';
      disposePreview();
      return;
    }
    reposition();
    queueMicrotask(() => searchEl?.focus());

    /** @param {PointerEvent} e */
    function onPointerDown(e) {
      const t = /** @type {Node} */ (e.target);
      if (menuEl?.contains(t)) return;
      if (anchorEl?.contains?.(t)) return;
      onClose?.();
    }

    window.addEventListener('resize', reposition);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('resize', reposition);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  });
</script>

{#if open}
  <div
    bind:this={menuEl}
    class="music-sample-picker flex flex-col"
    role="dialog"
    aria-label="Sample picker"
  >
    <div class="music-picker-head flex flex-col gap-1.5 p-2 flex-shrink-0 min-w-0">
      <input
        bind:this={searchEl}
        class="music-picker-search w-full"
        type="search"
        placeholder="Filter samples…"
        bind:value={query}
      />
      <div class="music-picker-cats thin-scrollbar flex gap-1 min-w-0">
        <button
          type="button"
          class="music-cat-chip"
          class:music-cat-chip-on={!category}
          onclick={() => (category = '')}
        >All</button>
        {#each SAMPLE_CATEGORIES as cat (cat)}
          <button
            type="button"
            class="music-cat-chip"
            class:music-cat-chip-on={category === cat}
            onclick={() => (category = cat)}
          >{cat}</button>
        {/each}
      </div>
    </div>
    <ul class="music-picker-list thin-scrollbar flex-1 min-h-0 overflow-y-auto m-0 p-0 list-none">
      {#each samples as sample (sample.id)}
        <li
          class="music-picker-item"
          class:music-picker-item-on={sample.url === currentUrl}
        >
          <span class="music-picker-name truncate flex-1 min-w-0">{sample.name}</span>
          <div class="music-picker-actions flex items-center gap-1">
            <button
              type="button"
              class="music-picker-action"
              class:music-picker-action-on={previewingId === sample.id}
              aria-label="Preview {sample.name}"
              title="Preview"
              onclick={() => previewSample(sample)}
            >▶</button>
            <button
              type="button"
              class="music-picker-action music-picker-use"
              aria-label="Use {sample.name}"
              title="Use"
              onclick={() => onSelect?.(sample)}
            >Use</button>
          </div>
        </li>
      {:else}
        <li class="music-picker-empty px-3 py-4 text-center">No samples</li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .music-sample-picker {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 1000;
    width: min(320px, calc(100vw - 16px));
    max-height: min(360px, calc(100vh - 24px));
    background: linear-gradient(180deg, #3a3a3e 0%, #252528 100%);
    border: 1px solid #0a0a0a;
    box-shadow:
      0 8px 28px rgba(0, 0, 0, 0.55),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    color: #d0d0d4;
  }

  .music-picker-head {
    min-width: 0;
  }

  .music-picker-search {
    background: #141416;
    border: 1px solid #0a0a0a;
    color: #e0e0e4;
    font-size: 12px;
    padding: 6px 8px;
    border-radius: 2px;
    outline: none;
  }

  .music-picker-search:focus {
    border-color: #4a8a4a;
  }

  .music-picker-cats {
    flex-wrap: nowrap;
    overflow-x: auto;
    min-width: 0;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }

  .music-cat-chip {
    flex-shrink: 0;
    font-size: 10px;
    text-transform: lowercase;
    padding: 2px 6px;
    border: 1px solid #1a1a1c;
    background: #2a2a2e;
    color: #a8a8ac;
    border-radius: 2px;
    cursor: pointer;
  }

  .music-cat-chip-on {
    background: #2a4a2a;
    color: #b8ffb8;
    border-color: #3a6a3a;
  }

  .music-picker-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 8px 6px 4px;
    font-size: 12px;
  }

  .music-picker-item:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .music-picker-item-on {
    background: rgba(60, 120, 60, 0.35);
    color: #d8ffd8;
  }

  .music-picker-name {
    font-weight: 500;
  }

  .music-picker-actions {
    flex-shrink: 0;
  }

  .music-picker-action {
    min-width: 26px;
    height: 24px;
    padding: 0 6px;
    border: 1px solid #0a0a0a;
    border-radius: 2px;
    background: linear-gradient(180deg, #4a4a50 0%, #323236 55%, #26262a 100%);
    color: #c8c8cc;
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.14),
      0 1px 1px rgba(0, 0, 0, 0.4);
  }

  .music-picker-action:hover {
    filter: brightness(1.08);
  }

  .music-picker-action:active {
    filter: brightness(0.92);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .music-picker-action-on {
    background: linear-gradient(180deg, #3a5a3a 0%, #2a3a2a 55%, #1e2a1e 100%);
    color: #d0e8d0;
  }

  .music-picker-use {
    min-width: 36px;
    background: linear-gradient(180deg, #55555c 0%, #3a3a40 55%, #2c2c30 100%);
    color: #e0e0e4;
  }

  .music-picker-empty {
    font-size: 12px;
    opacity: 0.55;
  }
</style>
