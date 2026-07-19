<script>
  // @ts-nocheck
  import { mediaRemoveTrack, mediaReorderTrack, mediaJumpTo } from './mediaSession';

  let { playlist = [], trackIndex = -1 } = $props();

  let dragFromIndex = $state(-1);
  let dragOverIndex = $state(-1);

  /** @param {string} url */
  function shortUrl(url) {
    return url.replace(/^https?:\/\/(www\.)?/, '');
  }

  /** @param {{ url?: string, label?: string } | null | undefined} track */
  function trackPrimaryLabel(track) {
    if (!track) return '';
    if (track.label) return track.label;
    return track.url ? shortUrl(track.url) : '';
  }

  function onRowPlay(index) {
    mediaJumpTo(index, true);
  }

  function onDragStart(index, e) {
    dragFromIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }

  function onDragOver(index, e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverIndex = index;
  }

  function onDrop(index, e) {
    e.preventDefault();
    const from = dragFromIndex >= 0 ? dragFromIndex : Number(e.dataTransfer.getData('text/plain'));
    if (Number.isFinite(from)) mediaReorderTrack(from, index);
    dragFromIndex = -1;
    dragOverIndex = -1;
  }

  function onDragEnd() {
    dragFromIndex = -1;
    dragOverIndex = -1;
  }
</script>

<div class="playlist-panel thin-scrollbar" role="list" aria-label="Playlist">
  {#each playlist as track, index (track.id)}
    <div
      class="playlist-row flex items-center gap-2"
      class:current={index === trackIndex}
      class:played={track.played && index !== trackIndex}
      class:drag-over={dragOverIndex === index}
      role="listitem"
      draggable="true"
      ondragstart={(e) => onDragStart(index, e)}
      ondragover={(e) => onDragOver(index, e)}
      ondrop={(e) => onDrop(index, e)}
      ondragend={onDragEnd}
    >
      <span class="drag-handle flex-shrink-0" aria-hidden="true" title="Drag to reorder">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </span>
      <button
        type="button"
        class="playlist-main min-w-0 flex-grow flex flex-col items-start"
        onclick={() => onRowPlay(index)}
      >
        <span class="playlist-url truncate w-full" title={track.label || track.url}>
          {trackPrimaryLabel(track)}
        </span>
        <span class="playlist-note truncate w-full" title={track.noteName}>
          {track.noteName}
          {#if track.played && index !== trackIndex}
            <span class="played-tag"> · played</span>
          {/if}
        </span>
      </button>
      <button
        type="button"
        class="icon-btn flex-shrink-0"
        onclick={() => mediaRemoveTrack(track.id)}
        aria-label="Remove track"
        title="Remove"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  {/each}
</div>

<style>
  .playlist-panel {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 220px;
    overflow-y: auto;
    background: var(--app-statusbar-background);
    border-bottom: 1px solid var(--app-statusbar-border);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.35);
    z-index: 4;
  }

  .playlist-row {
    padding: 6px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    color: #8a8a8a;
  }

  .playlist-row.current {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.88);
  }

  .playlist-row.played {
    opacity: 0.55;
  }

  .playlist-row.drag-over {
    outline: 1px dashed #525962;
    outline-offset: -1px;
  }

  .drag-handle {
    color: #555;
    cursor: grab;
  }

  .playlist-main {
    border: 0;
    background: transparent;
    color: inherit;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }

  .playlist-url {
    font-size: 11px;
  }

  .playlist-note {
    font-size: 10px;
    color: #606060;
  }

  .playlist-row.current .playlist-note {
    color: #808080;
  }

  .played-tag {
    color: #555;
  }

  .icon-btn {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: 3px;
    background: transparent;
    color: #a0a0a0;
    padding: 0;
    cursor: pointer;
  }

  .icon-btn:hover {
    color: rgba(255, 255, 255, 0.9);
    border-color: #404040;
    background: rgba(255, 255, 255, 0.06);
  }
</style>
