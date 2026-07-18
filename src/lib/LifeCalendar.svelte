<script>
  import { onMount, tick } from 'svelte';
  import { addYears, addDays, differenceInDays, format, startOfDay } from 'date-fns';
  import IconChevronLeft from './IconChevronLeft.svelte';
  import IconGraph from './IconGraph.svelte';
  import WeekNoteChart from './WeekNoteChart.svelte';
  import {
    birthDate,
    db,
    expectedLongevity,
    graphViewOpen,
    isMobile,
    lifeCalendarStat,
    LIFE_CALENDAR_STAT_MODES,
    selectNoteByGuid,
    sidebarOpen,
    sidebarWidth,
  } from './store';

  const MAX_WEEKS = 53;
  const WEEK_GUTTER_MIN_WIDTH = 712;
  const YEAR_STICKY_H = 28;
  const MONTH_STICKY_H = 26;
  const WEEK_STICKY_H = 28;
  const WEEK_NOTE_H = 34;
  const WEEK_SECTION_GAP = 2;
  const WEEK_OVERSCAN = 24;

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

  /**
   * @param {ReturnType<typeof buildLifeYears>['years']} yearRows
   */
  function buildLifetimeWeeks(yearRows) {
    /** @type {Array<{
     *   index: number,
     *   age: number,
     *   weekOfYear: number,
     *   start: Date,
     *   end: Date,
     *   startMs: number,
     *   endMs: number,
     *   status: string,
     *   rangeLabel: string,
     * }>} */
    const list = [];
    for (const year of yearRows) {
      for (let w = 0; w < year.weekCount; w++) {
        const week = year.weeks[w];
        if (typeof week.index !== 'number') continue;
        const start = addDays(year.start, w * 7);
        const end =
          w === year.weekCount - 1 ? year.end : addDays(year.start, (w + 1) * 7);
        list.push({
          index: week.index,
          age: year.age,
          weekOfYear: w,
          start,
          end,
          startMs: start.getTime(),
          endMs: end.getTime(),
          status: week.status,
          rangeLabel: `${format(start, 'MMM d')} – ${format(addDays(end, -1), 'MMM d, yyyy')}`,
        });
      }
    }
    return list;
  }

  /**
   * @param {Array<{ startMs: number, endMs: number, index: number }>} weeks
   * @param {number} ts
   */
  function findWeekListIndexForTs(weeks, ts) {
    let lo = 0;
    let hi = weeks.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const week = weeks[mid];
      if (ts < week.startMs) hi = mid - 1;
      else if (ts >= week.endMs) lo = mid + 1;
      else return mid;
    }
    return -1;
  }

  /**
   * @param {number[]} offsets
   * @param {number} y
   */
  function findWeekListIndexAtOffset(offsets, y) {
    let lo = 0;
    let hi = offsets.length - 2;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (y < offsets[mid]) hi = mid - 1;
      else if (y >= offsets[mid + 1]) lo = mid + 1;
      else return mid;
    }
    return Math.max(0, Math.min(offsets.length - 2, lo));
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
          <IconGraph />
        </button>
      {/if}
    </div>
    <div
      class="life-calendar-scroll thin-scrollbar flex-1 min-h-0 overflow-y-auto px-2 pb-5"
      role="region"
      aria-label="Life calendar: week {weeksIntoYear + 1} of age {yearsLived}, about {Math.max(currentGlobalIndex + 1, 0)} of {totalWeeks} weeks"
      {@attach (el) => {
        scrollEl = el;
        return () => {
          if (scrollEl === el) scrollEl = null;
        };
      }}
    >
      <div class="life-calendar-rows flex flex-col" style="--max-weeks: {maxWeeks};">
        {#if showWeekGutter}
          <div class="life-week-header life-year-row flex items-center min-w-0" aria-hidden="true">
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
            class="life-year-row flex items-center min-w-0"
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
  {:else if selectedYear && selected}
    <div class="week-view flex flex-col h-full min-h-0">
      <div class="week-view-header flex-shrink-0 flex flex-col">
        <div class="week-view-heading flex items-center min-w-0">
          <button
            type="button"
            class="week-back flex-shrink-0"
            aria-label="Back to life calendar"
            onclick={closeWeek}
          >
            <IconChevronLeft />
          </button>
          <div class="week-pane-meta flex flex-col flex-1 min-w-0">
            <h1 class="week-pane-title">Week {selected.weekOfYear + 1}</h1>
            {#if weekRangeLabel}
              <span class="week-pane-dates">{weekRangeLabel}</span>
            {/if}
          </div>
          {#if !$graphViewOpen}
            <button
              type="button"
              class="life-calendar-graph-btn flex-shrink-0 flex items-center justify-center"
              aria-label="Open graph view"
              title="Graph view"
              onclick={() => graphViewOpen.set(true)}
            >
              <IconGraph />
            </button>
          {/if}
          {#if currentWeekMeta}
            <button
              type="button"
              class="week-today flex-shrink-0"
              class:is-current={isViewingToday}
              aria-label="Jump to now. Double-click to zoom out to life calendar"
              title="Jump to now · Double-click to zoom out"
              onclick={goToToday}
              ondblclick={closeWeek}
            >
              Now
            </button>
          {/if}
        </div>
        <WeekNoteChart counts={yearWeekCounts} maxWeeks={maxWeeks} />
        <div
          class="life-year-row week-year-strip flex items-center min-w-0"
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
      <div class="week-stream flex-1 min-h-0 flex flex-col overflow-hidden" class:vt-pane={vtPane}>
        <div class="stream-pins flex-shrink-0" class:is-future={stickyIsFuture}>
          <div class="pin pin-year flex items-center border-box" style="height: {YEAR_STICKY_H}px">
            <span class="pin-label text-sm truncate">{stickyYearLabel}</span>
          </div>
          <div class="pin pin-month flex items-center border-box" style="height: {MONTH_STICKY_H}px">
            <span class="pin-label text-sm truncate">{stickyMonthLabel}</span>
          </div>
        </div>
        <div
          class="week-pane thin-scrollbar flex-1 min-h-0 overflow-y-auto"
          aria-label="Lifetime weeks scroller"
          {@attach (el) => {
            weekPaneEl = el;
            return () => {
              if (weekPaneEl === el) weekPaneEl = null;
            };
          }}
          onscroll={onWeekPaneScroll}
        >
          <div class="week-scroll-space flex-shrink-0" style="height: {topSpacer}px" aria-hidden="true"></div>
          {#each visibleWeeks as week (week.index)}
            {@const notes = notesForWeek(week.index)}
            <section
              class="week-block relative"
              class:is-focused={selected.index === week.index}
              class:is-future={week.status === 'future'}
              data-week-index={week.index}
            >
              <header class="week-sticky flex items-center">
                <span class="week-sticky-title text-sm">Week {week.weekOfYear + 1}</span>
              </header>
              {#if notes.length > 0}
                <ul class="week-note-list flex flex-col">
                  {#each notes as note (note.guid)}
                    <li>
                      <button
                        type="button"
                        class="week-note flex items-center justify-between w-full border-box bg-transparent"
                        onclick={() => openWeekNote(note.guid)}
                      >
                        <span class="week-note-name flex-1 min-w-0 truncate">{note.name}</span>
                        <span class="week-note-when flex-shrink-0">{format(note.createdAt, 'EEE')}</span>
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </section>
          {/each}
          <div class="week-scroll-space flex-shrink-0" style="height: {bottomSpacer}px" aria-hidden="true"></div>
        </div>
      </div>
    </div>
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

  .life-calendar-rows {
    gap: 1px;
  }

  .life-year-row {
    gap: 4px;
  }

  .life-year-row.vt-year {
    view-transition-name: life-year;
    contain: layout;
  }

  .week.vt-week {
    view-transition-name: life-week;
    contain: layout;
  }

  .week-stream.vt-pane {
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

  .week-view-header {
    gap: 8px;
    padding: 8px 8px 10px;
  }

  .week-view-heading {
    gap: 0.75rem;
  }

  .week-back {
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

  .week-today {
    margin-left: auto;
    margin-right: 2px;
    padding: 4px 8px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: color-mix(in srgb, var(--text-color) 60%, transparent);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    cursor: pointer;
  }

  .week-today:hover:not(.is-current) {
    background: color-mix(in srgb, var(--text-color) 8%, transparent);
  }

  .week-today.is-current {
    opacity: 0.35;
    cursor: default;
  }

  .week-year-strip {
    padding: 0 2px;
  }

  .week-stream {
    margin: 0 8px 8px;
  }

  .stream-pins {
    z-index: 3;
    border-bottom: 1px solid color-mix(in srgb, var(--text-color) 8%, transparent);
  }

  .stream-pins.is-future {
    opacity: 0.38;
  }

  .pin {
    padding: 0 10px;
  }

  .pin-year {
    border-bottom: 1px solid color-mix(in srgb, var(--text-color) 6%, transparent);
  }

  .pin-label {
    font-weight: 400;
    letter-spacing: 0.01em;
    opacity: 0.55;
  }

  .pin-year .pin-label {
    font-weight: 600;
    opacity: 0.72;
  }

  .week-pane {
    padding: 0;
    overflow-anchor: none;
  }

  .week-scroll-space {
    pointer-events: none;
  }

  .week-block {
    margin-bottom: 2px;
  }

  .week-sticky {
    position: sticky;
    top: 0;
    z-index: 2;
    height: 28px;
    padding: 0 10px;
    background: color-mix(in srgb, var(--app-background) 92%, var(--text-color));
    border-bottom: 1px solid color-mix(in srgb, var(--text-color) 8%, transparent);
    backdrop-filter: blur(6px);
  }

  .week-block.is-focused .week-sticky-title {
    color: var(--app-accent);
    opacity: 1;
  }

  .week-block.is-future {
    opacity: 0.38;
  }

  .week-sticky-title {
    font-weight: 400;
    letter-spacing: 0.01em;
    opacity: 0.55;
  }

  .week-pane-meta {
    gap: 3px;
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

  .week-note-list {
    list-style: none;
    margin: 0;
    padding: 0 4px 2px;
  }

  .week-note {
    gap: 8px;
    height: 34px;
    margin: 0;
    padding: 0 8px;
    border: none;
    border-radius: 6px;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .week-note:hover {
    background: color-mix(in srgb, var(--text-color) 8%, transparent);
  }

  .week-note-name {
    font-size: 13px;
  }

  .week-note-when {
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

    .week-sticky {
      background: color-mix(in srgb, var(--app-background) 92%, #fff);
    }
  }
</style>
