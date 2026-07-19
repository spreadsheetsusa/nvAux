<script>
  import { onMount, tick } from 'svelte';
  import { format, startOfDay } from 'date-fns';
  import Icon from '$lib/components/Icon.svelte';
  import LifeYearGrid from './LifeYearGrid.svelte';
  import WeekStreamView from './WeekStreamView.svelte';
  import {
    parseLocalDate,
    buildLifeYears,
    buildLifetimeWeeks,
    findWeekListIndexForTs,
    findWeekListIndexAtOffset,
  } from './lifeCalendarModel.js';
  import {
    birthDate,
    db,
    expectedLongevity,
    graphViewOpen,
    isMobile,
    lifeCalendarStat,
    LIFE_CALENDAR_STAT_MODES,
    selectNoteByGuid,
    selectedNote,
    sidebarOpen,
    sidebarWidth,
  } from '$lib/store';

  const WEEK_GUTTER_MIN_WIDTH = 712;
  const WEEK_STICKY_H = 28;
  const WEEK_NOTE_H = 34;
  const WEEK_SECTION_GAP = 2;
  const WEEK_OVERSCAN = 24;

  const today = startOfDay(new Date());

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
      title: 'Life Calendar',
      yearsOld: `${yearsLived} Years Old`,
      percentLived: `${percentLived.toFixed(2)}% of life lived`,
      yearsLived: `${yearsLivedPrecise.toFixed(2)} years of life lived`,
      percentRemaining: `${percentRemaining.toFixed(2)}% of life remaining`,
      yearsRemaining: `${yearsRemainingPrecise.toFixed(2)} years of life remaining`,
    }[$lifeCalendarStat] ?? 'Life Calendar',
  );

  let weekNumbers = $derived(Array.from({ length: maxWeeks }, (_, i) => i));
  let showWeekGutter = $derived($sidebarWidth >= WEEK_GUTTER_MIN_WIDTH);
  let lifetimeWeeks = $derived(buildLifetimeWeeks(years));

  /** Life-grid week index for the open note's createdAt (null when none / out of range). */
  let noteWeekIndex = $derived.by(() => {
    const guid = $selectedNote?.guid ?? null;
    if (!guid) return null;
    const ts = Number($selectedNote?.createdAt);
    if (!Number.isFinite(ts) || lifetimeWeeks.length === 0) return null;
    const listIndex = findWeekListIndexForTs(lifetimeWeeks, ts);
    if (listIndex < 0) return null;
    return lifetimeWeeks[listIndex].index;
  });

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
  /** @type {HTMLElement | null} */
  let weekPaneEl = $state(null);
  /** @type {any} */
  let db$ = $state(null);
  /** @type {Map<number, any[]>} */
  let notesByWeek = $state.raw(new Map());
  let scrollSyncLock = $state(false);
  let virtualScrollTop = $state(0);
  /** Pending list index to scroll to after week view mounts */
  /** @type {number | null} */
  let pendingScrollListIndex = $state(null);
  /** Track week-view open edge so note-sync doesn't steal the opening week click. */
  let weekViewWasOpen = false;
  /** @type {string | null} */
  let lastNoteSyncedGuid = null;
  /** Avoid re-scrolling the life grid for the same note/createdAt. */
  /** @type {string | null} */
  let lastLifeGridNoteScrollKey = null;

  let inWeekView = $derived(selected !== null);
  let selectedYear = $derived(
    selected ? years.find((y) => y.age === selected.age) : null,
  );
  let selectedWeekMeta = $derived(
    selected ? lifetimeWeeks.find((w) => w.index === selected.index) : null,
  );
  let weekRangeLabel = $derived(selectedWeekMeta?.rangeLabel ?? '');
  let stickyYearLabel = $derived(
    selected != null ? `Age ${selected.age}` : '',
  );
  let stickyMonthLabel = $derived(
    selectedWeekMeta ? format(selectedWeekMeta.start, 'MMMM yyyy') : '',
  );
  let stickyIsFuture = $derived(selectedWeekMeta?.status === 'future');
  let currentWeekMeta = $derived(
    lifetimeWeeks.find((w) => w.status === 'current') ??
      (currentGlobalIndex >= 0
        ? lifetimeWeeks.find((w) => w.index === currentGlobalIndex)
        : undefined),
  );
  let isViewingToday = $derived(
    !!selected && !!currentWeekMeta && selected.index === currentWeekMeta.index,
  );

  let yearWeekCounts = $derived.by(() => {
    const year = selectedYear;
    if (!year) return [];
    const map = notesByWeek;
    return year.weeks.map((week) =>
      week.status === 'absent' ? 0 : (map.get(week.index)?.length ?? 0),
    );
  });

  let weekHeights = $derived.by(() => {
    const map = notesByWeek;
    return lifetimeWeeks.map((week) => {
      const notes = map.get(week.index);
      const body = notes?.length ? notes.length * WEEK_NOTE_H : 0;
      return WEEK_STICKY_H + body + WEEK_SECTION_GAP;
    });
  });

  let weekOffsets = $derived.by(() => {
    const offsets = new Array(weekHeights.length + 1);
    offsets[0] = 0;
    for (let i = 0; i < weekHeights.length; i++) {
      offsets[i + 1] = offsets[i] + weekHeights[i];
    }
    return offsets;
  });

  let totalScrollHeight = $derived(
    weekOffsets.length > 0 ? weekOffsets[weekOffsets.length - 1] : 0,
  );

  let virtualRange = $derived.by(() => {
    const count = lifetimeWeeks.length;
    if (count === 0) return { start: 0, end: 0 };
    const viewport = weekPaneEl?.clientHeight ?? 480;
    const top = virtualScrollTop;
    const bottom = top + viewport;
    let start = findWeekListIndexAtOffset(weekOffsets, top);
    let end = findWeekListIndexAtOffset(weekOffsets, Math.max(top, bottom - 1));
    start = Math.max(0, start - WEEK_OVERSCAN);
    end = Math.min(count, end + 1 + WEEK_OVERSCAN);
    return { start, end };
  });

  let visibleWeeks = $derived(lifetimeWeeks.slice(virtualRange.start, virtualRange.end));
  let topSpacer = $derived(weekOffsets[virtualRange.start] ?? 0);
  let bottomSpacer = $derived(
    Math.max(0, totalScrollHeight - (weekOffsets[virtualRange.end] ?? totalScrollHeight)),
  );

  onMount(async () => {
    db$ = await db();
  });

  $effect(() => {
    const database = db$;
    const weeks = lifetimeWeeks;
    if (!database || !inWeekView || weeks.length === 0) {
      notesByWeek = new Map();
      return;
    }

    const startMs = weeks[0].startMs;
    const endMs = weeks[weeks.length - 1].endMs;

    const subscription = database.notes
      .find({
        selector: {
          createdAt: {
            $gte: startMs,
            $lt: endMs,
          },
        },
        sort: [{ createdAt: 'asc' }],
      })
      .$.subscribe((results) => {
        /** @type {Map<number, any[]>} */
        const map = new Map();
        for (const note of results) {
          const listIdx = findWeekListIndexForTs(weeks, note.createdAt);
          if (listIdx < 0) continue;
          const weekIndex = weeks[listIdx].index;
          const bucket = map.get(weekIndex);
          if (bucket) bucket.push(note);
          else map.set(weekIndex, [note]);
        }
        notesByWeek = map;
      });

    return () => subscription.unsubscribe();
  });

  $effect(() => {
    if (!inWeekView || pendingScrollListIndex == null || !weekPaneEl) return;
    const listIndex = pendingScrollListIndex;
    pendingScrollListIndex = null;
    scrollToListIndex(listIndex, false);
  });

  /**
   * Keep week stream aligned with the selected note (NoteList / Graph / etc.),
   * the same way NoteList scrolls to the open note. Only while week view is open;
   * does not override the week the user just zoomed into.
   */
  $effect(() => {
    const open = inWeekView && !!weekPaneEl;
    const guid = $selectedNote?.guid ?? null;
    const ts = Number($selectedNote?.createdAt);
    const weeks = lifetimeWeeks;

    if (!open) {
      weekViewWasOpen = false;
      return;
    }

    const justOpened = !weekViewWasOpen;
    weekViewWasOpen = true;

    if (!guid || !Number.isFinite(ts) || weeks.length === 0) return;

    if (justOpened) {
      lastNoteSyncedGuid = guid;
      return;
    }

    if (guid === lastNoteSyncedGuid) return;
    lastNoteSyncedGuid = guid;

    const listIndex = findWeekListIndexForTs(weeks, ts);
    if (listIndex < 0) return;
    const week = weeks[listIndex];
    selected = {
      age: week.age,
      weekOfYear: week.weekOfYear,
      index: week.index,
    };
    scrollToListIndex(listIndex, true);
  });

  /**
   * In the zoomed-out life grid, outline + scroll to the week that owns the
   * selected note's createdAt (NoteList / Graph / etc.).
   */
  $effect(() => {
    if (inWeekView || !scrollEl) return;

    const guid = $selectedNote?.guid ?? null;
    const ts = Number($selectedNote?.createdAt);
    const weekIndex = noteWeekIndex;

    if (!guid || weekIndex == null || !Number.isFinite(ts)) {
      lastLifeGridNoteScrollKey = null;
      return;
    }

    const key = `${guid}:${ts}`;
    if (key === lastLifeGridNoteScrollKey) return;
    lastLifeGridNoteScrollKey = key;

    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
    tick().then(() => {
      scrollEl
        ?.querySelector(`[data-week-index="${weekIndex}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior });
    });
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

  let scrollLockGen = 0;

  /**
   * @param {number} listIndex
   * @param {boolean} [smooth]
   */
  function scrollToListIndex(listIndex, smooth = true) {
    const pane = weekPaneEl;
    if (!pane || listIndex < 0 || listIndex >= lifetimeWeeks.length) return;
    const gen = ++scrollLockGen;
    const unlock = () => {
      if (gen === scrollLockGen) scrollSyncLock = false;
    };
    scrollSyncLock = true;
    virtualScrollTop = weekOffsets[listIndex] ?? 0;
    const behavior = smooth && !prefersReducedMotion() ? 'smooth' : 'auto';
    pane.scrollTo({
      top: weekOffsets[listIndex] ?? 0,
      behavior,
    });
    if (behavior === 'smooth') {
      pane.addEventListener('scrollend', unlock, { once: true });
      window.setTimeout(unlock, 1500);
    } else {
      window.setTimeout(unlock, 50);
    }
  }

  function goToToday() {
    const week = currentWeekMeta;
    if (!week || !selected || selected.index === week.index) return;
    selected = {
      age: week.age,
      weekOfYear: week.weekOfYear,
      index: week.index,
    };
    const listIndex = lifetimeWeeks.findIndex((w) => w.index === week.index);
    scrollToListIndex(listIndex >= 0 ? listIndex : week.index, true);
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
        const listIndex = lifetimeWeeks.findIndex((w) => w.index === index);
        pendingScrollListIndex = listIndex >= 0 ? listIndex : index;
        virtualScrollTop = weekOffsets[pendingScrollListIndex] ?? 0;
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
  function selectWeekInYear(age, weekOfYear, index) {
    if (!selected) return;
    if (selected.index === index) return;
    selected = { age, weekOfYear, index };
    const listIndex = lifetimeWeeks.findIndex((w) => w.index === index);
    scrollToListIndex(listIndex >= 0 ? listIndex : index, true);
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
        pendingScrollListIndex = null;
        virtualScrollTop = 0;
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

  /** @param {Event & { currentTarget: HTMLElement }} e */
  function onWeekPaneScroll(e) {
    const top = e.currentTarget.scrollTop;
    virtualScrollTop = top;
    if (scrollSyncLock || lifetimeWeeks.length === 0) return;
    const listIndex = findWeekListIndexAtOffset(weekOffsets, top + 1);
    const week = lifetimeWeeks[listIndex];
    if (!week) return;
    if (
      !selected ||
      selected.index !== week.index ||
      selected.age !== week.age ||
      selected.weekOfYear !== week.weekOfYear
    ) {
      selected = {
        age: week.age,
        weekOfYear: week.weekOfYear,
        index: week.index,
      };
    }
  }

  /** @param {string} guid */
  function openWeekNote(guid) {
    selectNoteByGuid(guid);
    // Mobile drawer: reveal the note in the main pane after selecting.
    if ($isMobile) sidebarOpen.set(false);
  }

  /** @param {number} weekIndex */
  function notesForWeek(weekIndex) {
    return notesByWeek.get(weekIndex) ?? [];
  }
</script>

<div
  class="life-calendar relative h-full flex flex-col overflow-hidden"
  class:vt-scope={vtDocumentScope}
  {@attach (el) => {
    scopeEl = el;
    return () => {
      if (scopeEl === el) scopeEl = null;
    };
  }}
>
  {#if !inWeekView}
    <div class="life-calendar-title-row flex items-center flex-shrink-0 min-w-0">
      <button
        type="button"
        class="life-calendar-title flex-1 min-w-0 select-none"
        title="Click to change stat"
        onclick={cycleTitleStat}
      >
        {titleStat}
      </button>
      {#if !$graphViewOpen}
        <button
          type="button"
          class="life-calendar-graph-btn flex-shrink-0 flex items-center justify-center"
          aria-label="Open graph view"
          title="Graph view"
          onclick={() => graphViewOpen.set(true)}
        >
          <Icon name="Graph" />
        </button>
      {/if}
    </div>
    <LifeYearGrid
      {years}
      {maxWeeks}
      {weekNumbers}
      {showWeekGutter}
      {vtAge}
      {vtWeekIndex}
      {noteWeekIndex}
      {weeksIntoYear}
      {yearsLived}
      {currentGlobalIndex}
      {totalWeeks}
      {onWeekClick}
      bind:scrollEl
    />
  {:else if selectedYear && selected}
    <WeekStreamView
      {selectedYear}
      {selected}
      {vtAge}
      {vtWeekIndex}
      {vtPane}
      {maxWeeks}
      {weekRangeLabel}
      {currentWeekMeta}
      {isViewingToday}
      {yearWeekCounts}
      {stickyIsFuture}
      {stickyYearLabel}
      {stickyMonthLabel}
      {visibleWeeks}
      {topSpacer}
      {bottomSpacer}
      {notesForWeek}
      {onWeekClick}
      onClose={closeWeek}
      onGoToToday={goToToday}
      {onWeekPaneScroll}
      onOpenWeekNote={openWeekNote}
      bind:weekPaneEl
    />
  {/if}
</div>

<style>
  .life-calendar {
    contain: layout;
    color: var(--text-color);
  }

  /* Document-scoped VT fallback only — element-scoped uses automatic root on this node */
  .life-calendar.vt-scope {
    view-transition-name: life-scope;
  }

  .life-calendar-title-row {
    margin: 11px 15px;
    gap: 6px;
  }

  .life-calendar-title {
    opacity: 0.7;
    font-size: 11px;
    letter-spacing: 0.04em;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    padding: 0;
    margin: 0;
  }

  .life-calendar-title:hover {
    opacity: 0.9;
  }

  .life-calendar-graph-btn {
    background: none;
    border: none;
    color: inherit;
    opacity: 0.45;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
  }

  .life-calendar-graph-btn:hover {
    opacity: 0.85;
  }
</style>
