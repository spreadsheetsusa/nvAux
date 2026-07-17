<script>
  import { onMount, tick } from 'svelte';
  import { addYears, addDays, differenceInDays, format, startOfDay } from 'date-fns';
  import IconChevronLeft from './IconChevronLeft.svelte';
  import {
    birthDate,
    db,
    expectedLongevity,
    lifeCalendarStat,
    LIFE_CALENDAR_STAT_MODES,
    selectNoteByGuid,
    selectedNote,
    sidebarWidth,
  } from './store';

  const MAX_WEEKS = 53;
  const WEEK_GUTTER_MIN_WIDTH = 712;
  /** @param {string} iso YYYY-MM-DD in local time (avoids UTC parse shift) */
  function parseLocalDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return startOfDay(new Date(y, m - 1, d));
  }

  const today = startOfDay(new Date());

  /**
   * Build life years from birth anniversaries.
   * Each year runs [Nth birthday, (N+1)th birthday) — addYears handles Feb 29.
   * 365-day spans get 52 real weeks; 366-day (leap) spans get 53.
   * Rows always pad to MAX_WEEKS with dimmed absent slots.
   */
  function buildLifeYears(birth, yearCount, now) {
    const years = [];
    let globalIndex = 0;
    let currentGlobalIndex = -1;

    for (let age = 0; age < yearCount; age++) {
      const start = addYears(birth, age);
      const end = addYears(birth, age + 1);
      const dayCount = differenceInDays(end, start);
      const weekCount = Math.max(1, dayCount >= 366 ? 53 : 52);

      const weeks = [];
      for (let w = 0; w < weekCount; w++) {
        const weekStart = addDays(start, w * 7);
        const weekEnd = w === weekCount - 1 ? end : addDays(start, (w + 1) * 7);
        let status = 'future';
        if (now >= weekEnd) status = 'past';
        else if (now >= weekStart && now < weekEnd) {
          status = 'current';
          currentGlobalIndex = globalIndex;
        }

        weeks.push({ index: globalIndex, status });
        globalIndex += 1;
      }

      for (let w = weekCount; w < MAX_WEEKS; w++) {
        weeks.push({ index: `a-${age}-${w}`, status: 'absent' });
      }

      years.push({ age, start, end, weekCount, weeks });
    }

    return { years, maxWeeks: MAX_WEEKS, currentGlobalIndex, totalWeeks: globalIndex };
  }

  let birth = $derived(parseLocalDate($birthDate || '1982-05-24'));
  let yearsCount = $derived(Math.max(1, parseInt($expectedLongevity, 10) || 80));
  let life = $derived(buildLifeYears(birth, yearsCount, today));
  let years = $derived(life.years);
  let maxWeeks = $derived(life.maxWeeks);
  let currentGlobalIndex = $derived(life.currentGlobalIndex);
  let totalWeeks = $derived(life.totalWeeks);
  let currentYear = $derived(years.find((y) => y.weeks.some((w) => w.status === 'current')));
  let yearsLived = $derived(
    currentYear ? currentYear.age : currentGlobalIndex < 0 ? 0 : yearsCount - 1,
  );
  let weeksIntoYear = $derived(
    currentYear ? currentYear.weeks.findIndex((w) => w.status === 'current') : 0,
  );
  let weeksLived = $derived(Math.max(currentGlobalIndex + 1, 0));
  let percentLived = $derived(
    totalWeeks > 0 ? Math.min(100, (weeksLived / totalWeeks) * 100) : 0,
  );
  let percentRemaining = $derived(
    totalWeeks > 0 ? Math.max(0, ((totalWeeks - weeksLived) / totalWeeks) * 100) : 0,
  );
  let yearsLivedPrecise = $derived(
    totalWeeks > 0 ? (weeksLived / totalWeeks) * yearsCount : 0,
  );
  let yearsRemainingPrecise = $derived(Math.max(0, yearsCount - yearsLivedPrecise));
  let titleStat = $derived(
    {
      percentLived: `${percentLived.toFixed(2)}% of life lived`,
      yearsLived: `${yearsLivedPrecise.toFixed(2)} years of life lived`,
      percentRemaining: `${percentRemaining.toFixed(2)}% of life remaining`,
      yearsRemaining: `${yearsRemainingPrecise.toFixed(2)} years of life remaining`,
    }[$lifeCalendarStat] ?? `${percentLived.toFixed(2)}% lived`,
  );

  let weekNumbers = $derived(Array.from({ length: maxWeeks }, (_, i) => i));
  let showWeekGutter = $derived($sidebarWidth >= WEEK_GUTTER_MIN_WIDTH);

  /** @type {{ age: number, weekOfYear: number, index: number } | null} */
  let selected = $state.raw(null);
  /** JIT view-transition targets — only set while a transition is armed/running */
  /** @type {number | null} */
  let vtAge = $state(null);
  /** @type {number | string | null} */
  let vtWeekIndex = $state(null);
  let vtPane = $state(false);
  let navigating = $state(false);
  /** Document-VT fallback: name the calendar so root (whole page) need not animate */
  let vtDocumentScope = $state(false);
  /** @type {HTMLElement | null} */
  let scopeEl = $state(null);
  /** @type {HTMLElement | null} */
  let scrollEl = $state(null);
  /** @type {any} */
  let db$ = $state(null);
  /** @type {any[]} */
  let weekNotes = $state([]);

  let inWeekView = $derived(selected !== null);
  let selectedYear = $derived(
    selected ? years.find((y) => y.age === selected.age) : null,
  );
  let selectedWeekRange = $derived.by(() => {
    if (!selected || !selectedYear) return null;
    const start = addDays(selectedYear.start, selected.weekOfYear * 7);
    const end =
      selected.weekOfYear === selectedYear.weekCount - 1
        ? selectedYear.end
        : addDays(selectedYear.start, (selected.weekOfYear + 1) * 7);
    return { start, end, startMs: start.getTime(), endMs: end.getTime() };
  });
  let selectedNoteGuid = $derived($selectedNote?.guid);
  let weekRangeLabel = $derived(
    selectedWeekRange
      ? `${format(selectedWeekRange.start, 'MMM d')} – ${format(addDays(selectedWeekRange.end, -1), 'MMM d, yyyy')}`
      : '',
  );

  onMount(async () => {
    db$ = await db();
  });

  $effect(() => {
    const database = db$;
    const range = selectedWeekRange;
    if (!database || !range) {
      weekNotes = [];
      return;
    }

    const subscription = database.notes
      .find({
        selector: {
          createdAt: {
            $gte: range.startMs,
            $lt: range.endMs,
          },
        },
        sort: [{ createdAt: 'asc' }],
      })
      .$.subscribe((results) => {
        weekNotes = results;
      });

    return () => subscription.unsubscribe();
  });

  function cycleTitleStat() {
    const modes = LIFE_CALENDAR_STAT_MODES;
    const idx = modes.indexOf($lifeCalendarStat);
    lifeCalendarStat.set(modes[(idx + 1) % modes.length]);
  }

  function prefersReducedMotion() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function setLifeNav(dir) {
    document.documentElement.dataset.lifeNav = dir;
  }

  function clearLifeNav() {
    delete document.documentElement.dataset.lifeNav;
    delete document.documentElement.dataset.lifeVt;
  }

  function clearVtTargets() {
    vtAge = null;
    vtWeekIndex = null;
    vtPane = false;
    vtDocumentScope = false;
  }

  /**
   * Prefer element-scoped VT (sidebar only). Fall back to document VT with
   * root animations disabled and a named life-scope on the calendar.
   * @param {() => void | Promise<void>} update
   */
  async function withViewTransition(update) {
    if (prefersReducedMotion()) {
      await update();
      return;
    }

    const runUpdate = async () => {
      await update();
      await tick();
    };

    /** @type {{ startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> } }} */
    const scope = scopeEl ?? {};
    /** @type {{ finished: Promise<void> } | undefined} */
    let transition;

    if (typeof scope.startViewTransition === 'function') {
      document.documentElement.dataset.lifeVt = 'scoped';
      transition = scope.startViewTransition(runUpdate);
    } else if (typeof document.startViewTransition === 'function') {
      document.documentElement.dataset.lifeVt = 'document';
      vtDocumentScope = true;
      await tick();
      transition = document.startViewTransition(runUpdate);
    } else {
      await runUpdate();
      return;
    }

    try {
      await transition.finished;
    } catch {
      /* skipped */
    }
  }

  /**
   * @param {number} age
   * @param {number} weekOfYear
   * @param {number} index
   */
  async function openWeek(age, weekOfYear, index) {
    if (navigating || selected) return;
    navigating = true;
    vtAge = age;
    vtWeekIndex = index;
    vtPane = true;
    setLifeNav('forward');
    await tick();
    try {
      await withViewTransition(() => {
        selected = { age, weekOfYear, index };
      });
    } finally {
      clearVtTargets();
      clearLifeNav();
      navigating = false;
    }
  }

  /**
   * @param {number} age
   * @param {number} weekOfYear
   * @param {number} index
   */
  async function selectWeekInYear(age, weekOfYear, index) {
    if (navigating || !selected) return;
    if (selected.index === index) return;
    const goingForward = index > selected.index;
    navigating = true;
    // Morph only the week cell; keep year strip still. Name the pane for a directional slide.
    vtWeekIndex = selected.index;
    vtPane = true;
    setLifeNav(goingForward ? 'week-fwd' : 'week-back');
    await tick();
    try {
      await withViewTransition(() => {
        vtWeekIndex = index;
        selected = { age, weekOfYear, index };
      });
    } finally {
      clearVtTargets();
      clearLifeNav();
      navigating = false;
    }
  }

  async function closeWeek() {
    if (navigating || !selected) return;
    const returnAge = selected.age;
    navigating = true;
    vtAge = selected.age;
    vtWeekIndex = selected.index;
    vtPane = true;
    setLifeNav('back');
    await tick();
    try {
      await withViewTransition(() => {
        selected = null;
      });
      await tick();
      scrollEl
        ?.querySelector(`[data-life-age="${returnAge}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    } finally {
      clearVtTargets();
      clearLifeNav();
      navigating = false;
    }
  }

  /**
   * @param {number} age
   * @param {number} weekOfYear
   * @param {{ index: number | string, status: string }} week
   */
  function onWeekClick(age, weekOfYear, week) {
    if (week.status === 'absent' || typeof week.index !== 'number') return;
    if (inWeekView) {
      selectWeekInYear(age, weekOfYear, week.index);
    } else {
      openWeek(age, weekOfYear, week.index);
    }
  }

  /** @param {string} guid */
  function openWeekNote(guid) {
    selectNoteByGuid(guid);
  }

</script>

<div
  class="life-calendar h-full flex flex-col overflow-hidden"
  class:vt-scope={vtDocumentScope}
  {@attach (el) => {
    scopeEl = el;
    return () => {
      if (scopeEl === el) scopeEl = null;
    };
  }}
>
  {#if !inWeekView}
    <button
      type="button"
      class="life-calendar-title"
      title="Click to change stat"
      onclick={cycleTitleStat}
    >
      {titleStat}
    </button>
    <div
      class="life-calendar-scroll thin-scrollbar overflow-y-auto px-2 pb-5"
      role="region"
      aria-label="Life calendar: week {weeksIntoYear + 1} of age {yearsLived}, about {Math.max(currentGlobalIndex + 1, 0)} of {totalWeeks} weeks"
      {@attach (el) => {
        scrollEl = el;
        return () => {
          if (scrollEl === el) scrollEl = null;
        };
      }}
    >
      <div class="life-calendar-rows" style="--max-weeks: {maxWeeks};">
        {#if showWeekGutter}
          <div class="life-week-header life-year-row" aria-hidden="true">
            <div class="year-gutter"></div>
            <div class="year-weeks week-gutter">
              {#each weekNumbers as weekNum (weekNum)}
                <div class="week-label">{weekNum}</div>
              {/each}
            </div>
          </div>
        {/if}
        {#each years as year (year.age)}
          <div
            class="life-year-row"
            class:vt-year={vtAge === year.age}
            data-life-age={year.age}
          >
            <div class="year-gutter" aria-hidden="true">{year.age}</div>
            <div class="year-weeks">
              {#each year.weeks as week, weekOfYear (week.index)}
                {#if week.status === 'absent'}
                  <div class="week absent" aria-hidden="true"></div>
                {:else}
                  <button
                    type="button"
                    class="week {week.status}"
                    class:anim-pulse={week.status === 'current'}
                    class:vt-week={vtWeekIndex === week.index}
                    aria-label="Age {year.age}, week {weekOfYear + 1}"
                    onclick={() => onWeekClick(year.age, weekOfYear, week)}
                  ></button>
                {/if}
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else if selectedYear}
    <div class="week-view flex flex-col h-full min-h-0">
      <div class="week-view-header">
        <button
          type="button"
          class="week-back"
          aria-label="Back to life calendar"
          onclick={closeWeek}
        >
          <IconChevronLeft />
        </button>
        <div class="week-pane-meta">
          <h1 class="week-pane-title">Week {selected.weekOfYear + 1}</h1>
          {#if weekRangeLabel}
            <span class="week-pane-dates">{weekRangeLabel}</span>
          {/if}
        </div>
        <div
          class="life-year-row week-year-strip"
          class:vt-year={vtAge === selectedYear.age}
          style="--max-weeks: {maxWeeks};"
        >
          <div class="year-gutter" aria-hidden="true">{selectedYear.age}</div>
          <div class="year-weeks">
            {#each selectedYear.weeks as week, weekOfYear (week.index)}
              {#if week.status === 'absent'}
                <div class="week absent" aria-hidden="true"></div>
              {:else}
                <button
                  type="button"
                  class="week {week.status}"
                  class:anim-pulse={week.status === 'current'}
                  class:selected={selected.index === week.index}
                  class:vt-week={vtWeekIndex === week.index}
                  aria-label="Age {selectedYear.age}, week {weekOfYear + 1}"
                  aria-current={selected.index === week.index ? 'true' : undefined}
                  onclick={() => onWeekClick(selectedYear.age, weekOfYear, week)}
                ></button>
              {/if}
            {/each}
          </div>
        </div>
      </div>
      <div
        class="week-pane thin-scrollbar"
        class:vt-pane={vtPane}
        aria-label="Week {selected.weekOfYear + 1} of age {selected.age}"
      >
        {#if weekNotes.length === 0}
          <p class="week-pane-empty">No notes created this week</p>
        {:else}
          <ul class="week-note-list">
            {#each weekNotes as note (note.guid)}
              <li>
                <button
                  type="button"
                  class="week-note"
                  class:active={selectedNoteGuid === note.guid}
                  onclick={() => openWeekNote(note.guid)}
                >
                  <span class="week-note-name">{note.name}</span>
                  <span class="week-note-when">{format(note.createdAt, 'EEE')}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .life-calendar {
    position: relative;
    contain: layout;
    color: var(--text-color);
  }

  /* Document-scoped VT fallback only — element-scoped uses automatic root on this node */
  .life-calendar.vt-scope {
    view-transition-name: life-scope;
  }

  .life-calendar-title {
    flex-shrink: 0;
    opacity: 0.7;
    font-size: 11px;
    letter-spacing: 0.04em;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    width: 100%;
    margin: 11px 15px;
  }

  .life-calendar-title:hover {
    opacity: 0.9;
  }

  .life-calendar-scroll {
    flex: 1;
    min-height: 0;
  }

  .life-calendar-rows {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .life-year-row {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .life-year-row.vt-year {
    view-transition-name: life-year;
    contain: layout;
  }

  .week.vt-week {
    view-transition-name: life-week;
    contain: layout;
  }

  .week-pane.vt-pane {
    view-transition-name: life-pane;
    contain: layout;
  }

  .year-gutter,
  .week-label {
    font-size: 8px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    opacity: 0.22;
    user-select: none;
  }

  .year-gutter {
    flex: 0 0 16px;
    width: 16px;
    text-align: right;
  }

  .week-label {
    min-width: 0;
    text-align: center;
    overflow: hidden;
  }

  .life-year-row:hover .year-gutter,
  .week-label:hover {
    opacity: 0.75;
  }

  .life-week-header {
    margin-bottom: 2px;
  }

  .year-weeks {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(var(--max-weeks), minmax(0, 1fr));
    gap: 1px;
  }

  .week {
    aspect-ratio: 1;
    border-radius: 0.5px;
    min-width: 0;
    min-height: 0;
    padding: 0;
    border: none;
    display: block;
    width: 100%;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    color: inherit;
  }

  .week.absent {
    cursor: default;
    pointer-events: none;
  }

  .week.past {
    background-color: #8a8a8a;
  }

  .week.current {
    background-color: var(--app-accent);
  }

  .week.future {
    background-color: transparent;
    box-shadow: inset 0 0 0 1px #9a9a9a;
  }

  .week.absent {
    background-color: transparent;
    box-shadow: inset 0 0 0 1px #c8c8c8;
    opacity: 0.35;
  }

  .week.selected {
    box-shadow:
      inset 0 0 0 1px var(--app-accent),
      0 0 0 1px var(--app-accent);
    z-index: 1;
    position: relative;
  }

  .week-view {
    min-height: 0;
  }

  .week-view-header {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 8px 10px;
  }

  .week-back {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    opacity: 0.55;
    cursor: pointer;
  }

  .week-back:hover {
    opacity: 0.95;
    background: color-mix(in srgb, var(--text-color) 8%, transparent);
  }

  .week-year-strip {
    padding: 0 2px;
  }

  .week-pane {
    flex: 1;
    min-height: 0;
    margin: 0 8px 8px;
    padding: 10px 8px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--text-color) 4%, transparent);
    overflow-y: auto;
  }

  .week-pane-meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 0 2px;
  }

  .week-pane-title {
    margin: 0;
    font-size: 18px;
    font-weight: 650;
    line-height: 1.2;
    letter-spacing: 0.01em;
    opacity: 0.92;
  }

  .week-pane-dates {
    font-size: 12px;
    opacity: 0.45;
  }

  .week-pane-empty {
    margin: 8px 4px;
    font-size: 12px;
    opacity: 0.4;
  }

  .week-note-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .week-note {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    margin: 0;
    padding: 8px 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .week-note:hover {
    background: color-mix(in srgb, var(--text-color) 8%, transparent);
  }

  .week-note.active {
    background: color-mix(in srgb, var(--app-accent) 22%, transparent);
  }

  .week-note-name {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .week-note-when {
    flex-shrink: 0;
    font-size: 11px;
    opacity: 0.4;
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-color-scheme: dark) {
    .week.past {
      background-color: #5a5e63;
    }

    .week.future {
      box-shadow: inset 0 0 0 1px #3a3e43;
    }

    .week.absent {
      box-shadow: inset 0 0 0 1px #2a2e33;
      opacity: 0.3;
    }

    .year-gutter,
    .week-label {
      opacity: 0.18;
    }

    .life-year-row:hover .year-gutter,
    .week-label:hover {
      opacity: 0.7;
    }

    .week-pane {
      background: color-mix(in srgb, #fff 4%, transparent);
    }
  }
</style>
