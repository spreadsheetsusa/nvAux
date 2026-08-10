<script>
  /**
   * Omnibar slash-command autocomplete list.
   * Keyboard navigation / autocomplete is owned by OmniBar.
   */
  /**
   * @typedef {{ type: string, aliases: string[], label: string, description: string }} OmniSlashCommand
   */

  let {
    /** @type {OmniSlashCommand[]} */
    candidates = [],
    selectedIndex = 0,
    visible = false,
    onSelect = /** @type {(cmd: OmniSlashCommand) => void} */ (() => {}),
    onHover = /** @type {(i: number) => void} */ (() => {}),
  } = $props();
</script>

{#if visible && candidates.length > 0}
  <ul
    id="omni-slash-suggest"
    class="omni-slash-suggest absolute z-30 m-0 p-0 list-none overflow-hidden border-box"
    role="listbox"
    aria-label="Slash command suggestions"
  >
    {#each candidates as cmd, i (cmd.type)}
      {@const secondary = cmd.aliases.slice(1)}
      <li
        class="omni-slash-suggest-item"
        class:active={i === selectedIndex}
        role="option"
        aria-selected={i === selectedIndex}
        onmouseenter={() => onHover(i)}
        onmousedown={(e) => {
          e.preventDefault();
          onSelect(cmd);
        }}
      >
        <div class="omni-slash-suggest-row flex items-center justify-between gap-2">
          <span class="omni-slash-suggest-alias">/{cmd.aliases[0]}</span>
          {#if secondary.length > 0}
            <span class="omni-slash-suggest-alts truncate">
              {secondary.map((a) => `/${a}`).join(' ')}
            </span>
          {/if}
        </div>
        <div class="omni-slash-suggest-desc truncate">{cmd.description}</div>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .omni-slash-suggest {
    left: 0;
    right: 0;
    top: calc(100% + 2px);
    min-width: 200px;
    max-height: 240px;
    overflow-y: auto;
    border: 1px solid #3a4149;
    border-radius: 6px;
    background: #1e242c;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) transparent;
  }

  .omni-slash-suggest-item {
    padding: 8px 10px;
    font-family: Arial, Helvetica, sans-serif;
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
  }

  .omni-slash-suggest-item.active,
  .omni-slash-suggest-item:hover {
    background: #2252a0;
    color: #fff;
  }

  .omni-slash-suggest-alias {
    font-size: 13px;
    font-weight: 600;
  }

  .omni-slash-suggest-alts {
    font-size: 11px;
    opacity: 0.55;
  }

  .omni-slash-suggest-item.active .omni-slash-suggest-alts,
  .omni-slash-suggest-item:hover .omni-slash-suggest-alts {
    opacity: 0.75;
  }

  .omni-slash-suggest-desc {
    margin-top: 2px;
    font-size: 12px;
    opacity: 0.7;
  }

  .omni-slash-suggest-item.active .omni-slash-suggest-desc,
  .omni-slash-suggest-item:hover .omni-slash-suggest-desc {
    opacity: 0.9;
  }
</style>
