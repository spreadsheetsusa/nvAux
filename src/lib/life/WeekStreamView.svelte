<script>
  import { format } from 'date-fns';
  import Icon from '$lib/components/Icon.svelte';
  import WeekNoteChart from './WeekNoteChart.svelte';
  import { graphViewOpen } from '$lib/store';

  const YEAR_STICKY_H = 28;
  const MONTH_STICKY_H = 26;

  let {
    selectedYear,
    selected,
    vtAge,
    vtWeekIndex,
    vtPane,
    maxWeeks,
    weekRangeLabel,
    currentWeekMeta,
    isViewingToday,
    yearWeekCounts,
    stickyIsFuture,
    stickyYearLabel,
    stickyMonthLabel,
    visibleWeeks,
    topSpacer,
    bottomSpacer,
    notesForWeek,
    onWeekClick,
    onClose,
    onGoToToday,
    onWeekPaneScroll,
    onOpenWeekNote,
    weekPaneEl = $bindable(null),
  } = $props();
</script>

<div class="week-view flex flex-col h-full min-h-0">
  <div class="week-view-header flex-shrink-0 flex flex-col">
    <div class="week-view-heading flex items-center min-w-0">
      <button
        type="button"
        class="week-back flex-shrink-0"
        aria-label="Back to life calendar"
        onclick={onClose}
      >
        <Icon name="ChevronLeft" />
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
          <Icon name="Graph" />
        </button>
      {/if}
      {#if currentWeekMeta}
        <button
          type="button"
          class="week-today flex-shrink-0"
          class:is-current={isViewingToday}
          aria-label="Jump to now. Double-click to zoom out to life calendar"
          title="Jump to now · Double-click to zoom out"
          onclick={onGoToToday}
          ondblclick={onClose}
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
                    onclick={() => onOpenWeekNote(note.guid)}
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

<style>
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

  .year-gutter {
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

  .life-year-row:hover .year-gutter {
    opacity: 0.75;
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

    .year-gutter {
      opacity: 0.18;
    }

    .life-year-row:hover .year-gutter {
      opacity: 0.7;
    }

    .week-sticky {
      background: color-mix(in srgb, var(--app-background) 92%, #fff);
    }
  }
</style>
