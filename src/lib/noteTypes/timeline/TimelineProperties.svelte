<script>
  // @ts-nocheck
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { birthDate } from '$lib/store';
  import { positionFixedMenu } from '../../../utils/positionFixedMenu.js';
  import {
    parseTimelineNote,
    serializeTimelineNote,
    setMode,
    MS,
    DEFAULT_RELATIVE_DURATION_MS,
  } from './timelineModel';
  import '$lib/notes/toolbarShared.css';

  let {
    body = '',
    onChange,
  } = $props();

  let parsed = $derived(parseTimelineNote(body ?? ''));
  let project = $derived(parsed.project);
  let mode = $derived(project?.mode ?? 'relative');
  let durationHours = $derived(
    Math.round(((project?.durationMs ?? DEFAULT_RELATIVE_DURATION_MS) / MS.HOUR) * 10) / 10
  );
  let anchorDate = $derived(project?.anchorDate ?? '');
  let useBirthAnchor = $derived(!!project?.useBirthAnchor);

  let open = $state(false);
  /** @type {HTMLDivElement | undefined} */
  let rootEl = $state();
  /** @type {HTMLButtonElement | undefined} */
  let triggerEl = $state();
  /** @type {HTMLDivElement | undefined} */
  let menuEl = $state();

  function emit(nextProject, nextTheme = parsed.theme) {
    onChange?.(serializeTimelineNote(nextTheme, nextProject));
  }

  /** @param {'calendar' | 'relative'} next */
  function onMode(next) {
    if (!project || project.mode === next) return;
    const birth = get(birthDate);
    emit(setMode(project, next, { birthDate: birth }));
  }

  /** @param {Event} e */
  function onDuration(e) {
    if (!project || project.mode !== 'relative') return;
    const v = Number(/** @type {HTMLInputElement} */ (e.currentTarget).value);
    if (!Number.isFinite(v) || v <= 0) return;
    const durationMs = Math.max(MS.HOUR, v * MS.HOUR);
    emit({ ...project, durationMs });
  }

  /** @param {Event} e */
  function onAnchor(e) {
    if (!project) return;
    const v = /** @type {HTMLInputElement} */ (e.currentTarget).value;
    emit({
      ...project,
      anchorDate: /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null,
      useBirthAnchor: false,
    });
  }

  /** @param {Event} e */
  function onBirthToggle(e) {
    if (!project) return;
    const checked = /** @type {HTMLInputElement} */ (e.currentTarget).checked;
    const birth = get(birthDate);
    emit({
      ...project,
      useBirthAnchor: checked,
      anchorDate: checked && birth ? birth : project.anchorDate,
    });
  }

  function clearItems() {
    if (!project) return;
    emit({ ...project, items: [] });
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
    if (!open) return;
    reposition();
    const onReposition = () => reposition();
    const onPointerDown = (e) => {
      if (!rootEl?.contains(e.target)) close();
    };
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
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
    aria-label="Timeline properties"
    aria-haspopup="menu"
    aria-expanded={open}
    title="Timeline properties"
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
      class="props-menu"
      bind:this={menuEl}
      role="menu"
      tabindex="-1"
    >
      <div class="props-section">
        <div class="props-label">Mode</div>
        <div class="props-row">
          <button
            type="button"
            class="props-seg"
            class:active={mode === 'relative'}
            onclick={() => onMode('relative')}
          >
            Relative
          </button>
          <button
            type="button"
            class="props-seg"
            class:active={mode === 'calendar'}
            onclick={() => onMode('calendar')}
          >
            Calendar
          </button>
        </div>
      </div>

      {#if mode === 'relative'}
        <div class="props-section">
          <label class="props-label" for="tl-duration">Duration (hours)</label>
          <input
            id="tl-duration"
            class="props-input"
            type="number"
            min="1"
            step="0.5"
            value={durationHours}
            onchange={onDuration}
          />
        </div>
      {:else}
        <div class="props-section">
          <label class="props-label" for="tl-anchor">Anchor date</label>
          <input
            id="tl-anchor"
            class="props-input"
            type="date"
            value={anchorDate}
            disabled={useBirthAnchor}
            onchange={onAnchor}
          />
          <label class="props-check">
            <input
              type="checkbox"
              checked={useBirthAnchor}
              onchange={onBirthToggle}
            />
            Pin to Profile birth date
          </label>
        </div>
      {/if}

      <div class="props-section">
        <div class="props-muted">
          Lanes {project?.lanes?.length ?? 0} · Steps {project?.items?.length ?? 0}
        </div>
        <button type="button" class="props-danger" onclick={clearItems}>
          Clear steps
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .props-menu {
    position: fixed;
    z-index: 80;
    min-width: 220px;
    max-width: min(280px, calc(100vw - 16px));
    padding: 10px;
    border-radius: 6px;
    background: var(--app-omni-background);
    border: 1px solid var(--app-statusbar-border);
    color: var(--text-color);
    box-shadow: 0 8px 24px color-mix(in srgb, #000 16%, transparent);
  }
  .props-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .props-section + .props-section {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--app-statusbar-border);
  }
  .props-label {
    font-size: 11px;
    opacity: 0.7;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .props-row {
    display: flex;
    gap: 4px;
  }
  .props-seg {
    flex: 1;
    border: 1px solid var(--app-statusbar-border);
    background: var(--app-background);
    color: inherit;
    border-radius: 4px;
    padding: 4px 6px;
    font-size: 12px;
    cursor: pointer;
  }
  .props-seg.active {
    border-color: color-mix(in srgb, var(--app-accent) 55%, var(--app-statusbar-border));
    background: color-mix(in srgb, var(--app-accent) 16%, var(--app-background));
  }
  .props-input {
    border: 1px solid var(--app-statusbar-border);
    background: var(--app-background);
    color: inherit;
    border-radius: 4px;
    padding: 4px 6px;
    font-size: 12px;
  }
  .props-check {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    cursor: pointer;
  }
  .props-muted {
    font-size: 12px;
    opacity: 0.65;
  }
  .props-danger {
    border: 1px solid var(--app-statusbar-border);
    background: var(--app-background);
    color: inherit;
    border-radius: 4px;
    padding: 5px 8px;
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }
  .props-danger:hover {
    border-color: color-mix(in srgb, #b00020 40%, var(--app-statusbar-border));
  }
</style>
