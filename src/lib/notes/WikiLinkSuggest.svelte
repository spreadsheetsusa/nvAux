<script>
  /**
   * Lightweight [[wiki link]] autocomplete list.
   * Keyboard navigation is owned by the parent (textarea keydown).
   */
  let {
    candidates = [],
    selectedIndex = 0,
    left = 0,
    top = 0,
    visible = false,
    onSelect = () => {},
    onHover = () => {},
  } = $props();
</script>

{#if visible && candidates.length > 0}
  <ul
    class="wiki-suggest absolute z-20 m-0 p-0 list-none overflow-hidden border-box"
    style="left: {left}px; top: {top}px;"
    role="listbox"
    aria-label="Note title suggestions"
  >
    {#each candidates as name, i (name)}
      <li
        class="wiki-suggest-item truncate"
        class:active={i === selectedIndex}
        role="option"
        aria-selected={i === selectedIndex}
        onmouseenter={() => onHover(i)}
        onmousedown={(e) => {
          e.preventDefault();
          onSelect(name);
        }}
      >
        {name}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .wiki-suggest {
    min-width: 160px;
    max-width: min(320px, 100%);
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid #3a4149;
    border-radius: 6px;
    background: #1e242c;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) transparent;
  }

  .wiki-suggest-item {
    padding: 6px 10px;
    font-size: 13px;
    font-family: Arial, Helvetica, sans-serif;
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
  }

  .wiki-suggest-item.active,
  .wiki-suggest-item:hover {
    background: #2252a0;
    color: #fff;
  }
</style>
