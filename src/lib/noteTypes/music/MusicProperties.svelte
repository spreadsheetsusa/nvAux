<script>
  // @ts-nocheck
  import { onMount, onDestroy } from 'svelte';
  import { positionFixedMenu } from '../../../utils/positionFixedMenu.js';
  import {
    parseMusicNote,
    serializeMusicNote,
    clearAllPatterns,
    setSteps,
    MIN_BPM,
    MAX_BPM,
    STEP_OPTIONS,
    PATTERN_BANK_SIZE,
  } from './musicModel';
  import '$lib/notes/toolbarShared.css';

  let {
    body = '',
    onChange,
  } = $props();

  let parsed = $derived(parseMusicNote(body ?? ''));
  let bpm = $derived(parsed.project?.bpm ?? 120);
  let steps = $derived(parsed.project?.steps ?? 16);
  let skin = $derived(parsed.theme?.skin || 'winamp');
  let activePattern = $derived((parsed.project?.activePattern ?? 0) + 1);

  let open = $state(false);
  /** @type {HTMLDivElement | undefined} */
  let rootEl = $state();
  /** @type {HTMLButtonElement | undefined} */
  let triggerEl = $state();
  /** @type {HTMLDivElement | undefined} */
  let menuEl = $state();

  function emitProject(nextProject, nextTheme = parsed.theme) {
    onChange?.(serializeMusicNote(nextTheme, nextProject));
  }

  /** @param {Event} e */
  function onBpmInput(e) {
    const v = Number(/** @type {HTMLInputElement} */ (e.currentTarget).value);
    if (!Number.isFinite(v) || !parsed.project) return;
    const nextBpm = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v)));
    emitProject({ ...parsed.project, bpm: nextBpm });
  }

  /** @param {number} next */
  function onSteps(next) {
    if (!parsed.project) return;
    emitProject(setSteps(parsed.project, next));
  }

  function clearPattern() {
    if (!parsed.project) return;
    emitProject(clearAllPatterns(parsed.project));
    close();
  }

  function toggleOpen(e) {
    e.stopPropagation();
    open = !open;
  }

  function close() {
    open = false;
  }

  /** @param {KeyboardEvent} e */
  function handleKeydown(e) {
    if (e.key !== 'Escape' || !open) return;
    e.preventDefault();
    e.stopPropagation();
    close();
  }

  /** @param {FocusEvent} e */
  function handleFocusOut(e) {
    if (!open) return;
    const next = /** @type {Node | null} */ (e.relatedTarget);
    if (next && rootEl?.contains(next)) return;
    queueMicrotask(() => {
      if (!open) return;
      if (rootEl?.contains(document.activeElement)) return;
      close();
    });
  }

  function reposition() {
    if (!open || !triggerEl || !menuEl) return;
    positionFixedMenu(triggerEl.getBoundingClientRect(), menuEl);
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
  });

  $effect(() => {
    if (!open || !triggerEl || !menuEl) return;
    reposition();
    queueMicrotask(() => {
      const first = menuEl?.querySelector('button, input');
      if (first instanceof HTMLElement) first.focus();
    });

    /** @param {PointerEvent} e */
    function onPointerDown(e) {
      if (rootEl?.contains(/** @type {Node} */ (e.target))) return;
      close();
    }

    window.addEventListener('resize', reposition);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('resize', reposition);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  });
</script>

<div
  class="theme-anchor flex-shrink-0"
  bind:this={rootEl}
  onfocusout={handleFocusOut}
>
  <button
    bind:this={triggerEl}
    type="button"
    class="toolbar-btn flex-shrink-0 icon-btn"
    class:active={open}
    onclick={toggleOpen}
    aria-label="Music properties"
    aria-haspopup="menu"
    aria-expanded={open}
    title="Music properties"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="feather feather-more-vertical"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="1"></circle>
      <circle cx="12" cy="5" r="1"></circle>
      <circle cx="12" cy="19" r="1"></circle>
    </svg>
  </button>

  {#if open}
    <div
      bind:this={menuEl}
      class="theme-menu context-menu"
      role="menu"
      tabindex="-1"
      aria-label="Music properties"
      onkeydown={handleKeydown}
    >
      <div class="music-props-row">
        <label class="music-props-label" for="music-props-bpm">BPM</label>
        <input
          id="music-props-bpm"
          class="music-props-input"
          type="number"
          min={MIN_BPM}
          max={MAX_BPM}
          value={bpm}
          onchange={onBpmInput}
        />
      </div>
      <div class="music-props-row">
        <span class="music-props-label">Steps</span>
        <div class="music-props-steps flex gap-0.5">
          {#each STEP_OPTIONS as opt (opt)}
            <button
              type="button"
              class="music-props-step"
              class:music-props-step-on={steps === opt}
              onclick={() => onSteps(opt)}
              aria-pressed={steps === opt}
            >{opt}</button>
          {/each}
        </div>
      </div>
      <div class="music-props-row music-props-muted">
        <span class="music-props-label">Pattern</span>
        <span>{activePattern} / {PATTERN_BANK_SIZE}</span>
      </div>
      <div class="music-props-row music-props-muted">
        <span class="music-props-label">Skin</span>
        <span>{skin}</span>
      </div>
      <button
        type="button"
        class="music-props-action"
        role="menuitem"
        onclick={clearPattern}
      >
        Clear pattern
      </button>
    </div>
  {/if}
</div>

<style>
  .theme-menu {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 1000;
    min-width: 200px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--app-omni-background);
    border: 1px solid var(--app-statusbar-border, #2b2d30);
    border-radius: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    color: var(--text-color);
    font-size: 12px;
  }

  .music-props-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
  }

  .music-props-muted {
    opacity: 0.7;
  }

  .music-props-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.75;
  }

  .music-props-input {
    width: 64px;
    height: 26px;
    text-align: center;
    font-size: 12px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 4px;
    color: inherit;
  }

  .music-props-step {
    min-width: 32px;
    height: 24px;
    padding: 0 6px;
    font-size: 11px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 3px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .music-props-step-on {
    background: color-mix(in srgb, var(--app-accent, #ed0178) 35%, transparent);
    border-color: color-mix(in srgb, var(--app-accent, #ed0178) 55%, transparent);
  }

  .music-props-action {
    width: 100%;
    text-align: left;
    padding: 6px 8px;
    font-size: 12px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .music-props-action:hover {
    background: rgba(255, 255, 255, 0.06);
  }
</style>
