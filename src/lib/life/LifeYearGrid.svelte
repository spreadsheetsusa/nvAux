<script>
  /**
   * @typedef {{ index: number | string, status: string }} Week
   * @typedef {{ age: number, start: Date, end: Date, weekCount: number, weeks: Week[] }} Year
   */
  let {
    years,
    maxWeeks,
    weekNumbers,
    showWeekGutter,
    vtAge,
    vtWeekIndex,
    noteWeekIndex,
    weeksIntoYear,
    yearsLived,
    currentGlobalIndex,
    totalWeeks,
    onWeekClick,
    scrollEl = $bindable(null),
  } = $props();
</script>

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
                class:selected={noteWeekIndex === week.index}
                class:vt-week={vtWeekIndex === week.index}
                data-week-index={week.index}
                aria-current={noteWeekIndex === week.index ? 'true' : undefined}
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

<style>
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
  }
</style>
