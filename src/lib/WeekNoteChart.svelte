<script>
  /**
   * Compact SVG sparkline of note counts per week, aligned to the year strip.
   * @typedef {{ counts?: number[]; maxWeeks?: number; label?: string }} Props
   * @type {Props}
   */
  let { counts = [], maxWeeks = 53, label = 'Notes per week' } = $props();

  const CHART_H = 26;
  const PAD_Y = 3;
  const DOT_R = 1.75;
  const PEAK_R = 2.75;

  let chartWidth = $state(0);

  let maxCount = $derived(counts.reduce((m, n) => (n > m ? n : m), 0));

  let points = $derived.by(() => {
    const w = chartWidth;
    const n = maxWeeks;
    if (w <= 0 || n <= 0) return [];

    const plotH = CHART_H - PAD_Y * 2;
    const baseline = CHART_H - PAD_Y;

    return Array.from({ length: n }, (_, i) => {
      const count = counts[i] ?? 0;
      const x = ((i + 0.5) / n) * w;
      const y =
        maxCount > 0 ? baseline - (count / maxCount) * plotH : baseline;
      return { x, y, count, peak: maxCount > 0 && count === maxCount };
    });
  });

  let linePoints = $derived(
    points.length ? points.map((p) => `${p.x},${p.y}`).join(' ') : '',
  );
</script>

<div
  class="week-note-chart flex items-center min-w-0"
  aria-label={label}
  role="img"
>
  <div class="year-gutter" aria-hidden="true"></div>
  <div class="chart-host" bind:clientWidth={chartWidth}>
    {#if chartWidth > 0}
      <svg
        class="sparkline"
        width={chartWidth}
        height={CHART_H}
        viewBox="0 0 {chartWidth} {CHART_H}"
        aria-hidden="true"
      >
        {#if linePoints}
          <polyline class="spark-line" points={linePoints} fill="none" />
        {/if}
        {#each points as p, i (i)}
          {#if p.count > 0}
            <circle
              class="spark-dot"
              class:peak={p.peak}
              cx={p.x}
              cy={p.y}
              r={p.peak ? PEAK_R : DOT_R}
            />
          {/if}
        {/each}
      </svg>
    {/if}
  </div>
</div>

<style>
  .week-note-chart {
    gap: 4px;
    padding: 0 2px;
    height: 26px;
    flex-shrink: 0;
  }

  .year-gutter {
    flex: 0 0 16px;
    width: 16px;
  }

  .chart-host {
    flex: 1;
    min-width: 0;
    height: 26px;
    display: block;
  }

  .sparkline {
    display: block;
    width: 100%;
    height: 26px;
    overflow: visible;
  }

  .spark-line {
    stroke: color-mix(in srgb, var(--text-color) 35%, transparent);
    stroke-width: 1.25;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .spark-dot {
    fill: color-mix(in srgb, var(--text-color) 45%, transparent);
  }

  .spark-dot.peak {
    fill: var(--app-accent);
  }
</style>
