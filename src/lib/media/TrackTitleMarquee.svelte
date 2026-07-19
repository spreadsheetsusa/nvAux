<script>
  // @ts-nocheck
  let { displayTitle = '', sourceNoteGuid = '', onOpenSourceNote } = $props();

  /** @type {HTMLDivElement | null} */
  let marqueeEl = $state(null);
  /** @type {HTMLSpanElement | null} */
  let marqueeMeasureEl = $state(null);
  let marqueeScrolling = $state(false);

  // Overflow-aware marquee: scroll only when the combined title doesn't fit.
  $effect(() => {
    const text = displayTitle;
    const el = marqueeEl;
    const measure = marqueeMeasureEl;
    if (!el || !measure || !text) {
      marqueeScrolling = false;
      return;
    }

    const update = () => {
      marqueeScrolling = measure.scrollWidth > el.clientWidth + 1;
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  });

  function handleDblClick() {
    onOpenSourceNote?.();
  }
</script>

{#if displayTitle}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="track-title marquee min-w-0"
    class:scrolling={marqueeScrolling}
    class:has-source={!!sourceNoteGuid}
    bind:this={marqueeEl}
    title={sourceNoteGuid ? `${displayTitle} — Double-click to open note` : displayTitle}
    ondblclick={handleDblClick}
    style={marqueeScrolling
      ? `--marquee-duration: ${Math.max(10, displayTitle.length * 0.35)}s`
      : undefined}
  >
    <span class="marquee-measure" bind:this={marqueeMeasureEl} aria-hidden="true">
      {displayTitle}
    </span>
    <div class="marquee-viewport">
      <div class="marquee-track">
        <span class="marquee-text">{displayTitle}</span>
        {#if marqueeScrolling}
          <span class="marquee-text" aria-hidden="true">{displayTitle}</span>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .track-title {
    flex: 0 1 14em;
    color: #a0a0a0;
    position: relative;
    overflow: hidden;
    min-width: 4em;
  }

  .track-title.has-source {
    cursor: pointer;
  }

  .marquee-measure {
    position: absolute;
    visibility: hidden;
    white-space: nowrap;
    pointer-events: none;
  }

  .marquee-viewport {
    overflow: hidden;
    width: 100%;
  }

  .marquee-track {
    display: inline-flex;
    white-space: nowrap;
    will-change: transform;
  }

  .marquee.scrolling .marquee-text {
    padding-right: 2.5em;
  }

  .marquee.scrolling .marquee-track {
    animation: marquee-scroll linear infinite;
    animation-duration: var(--marquee-duration, 12s);
  }

  @keyframes marquee-scroll {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-50%);
    }
  }
</style>
