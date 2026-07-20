<script>
  // @ts-nocheck
  import { PATTERN_BANK_SIZE } from './musicModel';

  let {
    patternBank = [],
    activePattern = 0,
    onSelect,
  } = $props();

  /** @param {number} index */
  function isFilled(index) {
    return !!patternBank?.[index];
  }
</script>

<div class="music-bank" aria-label="Pattern bank">
  <div class="music-bank-lcd" aria-hidden="true">PAT</div>
  <div class="music-bank-grid" role="group" aria-label="Pattern slots">
    {#each Array(PATTERN_BANK_SIZE) as _, i (i)}
      {@const filled = isFilled(i)}
      {@const active = activePattern === i}
      <button
        type="button"
        class="music-bank-slot"
        class:music-bank-slot-filled={filled && !active}
        class:music-bank-slot-active={active}
        onclick={() => onSelect?.(i)}
        aria-label="Pattern {i + 1}{active ? ' (active)' : filled ? ' (saved)' : ''}"
        aria-pressed={active}
        title="Pattern {i + 1}"
      ></button>
    {/each}
  </div>
</div>

<style>
  .music-bank {
    width: 85px;
    flex-shrink: 0;
    align-self: stretch;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 8px;
    padding: 10px 12px;
    background: linear-gradient(180deg, #3a3a3e 0%, #252528 55%, #1a1a1e 100%);
    border-right: 1px solid #0a0a0a;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset -1px 0 0 rgba(0, 0, 0, 0.35);
  }

  .music-bank-lcd {
    width: 100%;
    text-align: center;
    font-size: 8px;
    letter-spacing: 0.18em;
    font-family: 'Courier New', Courier, monospace;
    color: var(--app-accent, #ed0178);
    text-shadow: 0 0 5px color-mix(in srgb, var(--app-accent, #ed0178) 50%, transparent);
    background: color-mix(in srgb, var(--app-accent, #ed0178) 8%, #0a0a0c);
    border: 1px solid #111;
    padding: 2px 0;
    box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.75);
  }

  .music-bank-grid {
    display: grid;
    grid-template-columns: repeat(3, 18px);
    grid-template-rows: repeat(3, 18px);
    gap: 3px;
  }

  .music-bank-slot {
    width: 18px;
    height: 18px;
    padding: 0;
    border: 1px solid #0a0a0a;
    border-radius: 2px;
    background: linear-gradient(180deg, #2a2a2e 0%, #16161a 100%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    cursor: pointer;
  }

  .music-bank-slot:hover {
    filter: brightness(1.15);
  }

  .music-bank-slot-filled {
    background: color-mix(in srgb, var(--app-accent, #ed0178) 28%, #222228);
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--app-accent, #ed0178) 40%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .music-bank-slot-active {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--app-accent, #ed0178) 80%, #fff) 0%,
      var(--app-accent, #ed0178) 55%,
      color-mix(in srgb, var(--app-accent, #ed0178) 50%, #000) 100%
    );
    box-shadow:
      0 0 6px color-mix(in srgb, var(--app-accent, #ed0178) 55%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.25);
  }
</style>
