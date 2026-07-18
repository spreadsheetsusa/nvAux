<script>
  import MarketingSection from './MarketingSection.svelte';

  /**
   * @type {{
   *   eyebrow: string,
   *   title: string,
   *   body: string,
   *   align?: 'left' | 'right',
   *   motif?: 'omnibar' | 'local' | 'calendar' | 'graph' | 'media',
   * }}
   */
  let { eyebrow, title, body, align = 'left', motif } = $props();
</script>

<MarketingSection {eyebrow} {title} {align} wide className="spotlight">
  <div class="spotlight-row" class:row-reverse={align === 'right'}>
    <div class="spotlight-copy">
      <p class="spotlight-body">{body}</p>
    </div>
    {#if motif}
      <div class="spotlight-visual" aria-hidden="true">
        <div class="visual-panel motif-{motif}">
          {#if motif === 'omnibar'}
            <div class="omni-chrome">
              <span class="omni-icon">⌕</span>
              <span class="omni-placeholder">Search or Create</span>
              <span class="omni-caret"></span>
            </div>
            <div class="omni-hits">
              <span>Welcome to nvAux</span>
              <span class="omni-hit-dim">Life calendar notes…</span>
            </div>
          {:else if motif === 'local'}
            <div class="local-stack">
              <i></i><i></i><i></i>
            </div>
            <p class="visual-caption">IndexedDB · Offline · Yours</p>
          {:else if motif === 'calendar'}
            <div class="cal-grid">
              {#each Array.from({ length: 28 }, (_, i) => i) as i (i)}
                <i class:lit={i < 11} class:now={i === 11}></i>
              {/each}
            </div>
            <p class="visual-caption">Every week of your life</p>
          {:else if motif === 'graph'}
            <svg class="graph-svg" viewBox="0 0 160 96" fill="none">
              <line x1="28" y1="52" x2="78" y2="28" stroke="currentColor" stroke-width="1.5" opacity="0.45" />
              <line x1="78" y1="28" x2="128" y2="58" stroke="currentColor" stroke-width="1.5" opacity="0.45" />
              <line x1="28" y1="52" x2="128" y2="58" stroke="currentColor" stroke-width="1.25" opacity="0.28" />
              <line x1="78" y1="28" x2="88" y2="78" stroke="currentColor" stroke-width="1.25" opacity="0.35" />
              <circle cx="28" cy="52" r="8" fill="var(--app-accent, #ed0178)" opacity="0.9" />
              <circle cx="78" cy="28" r="10" fill="var(--app-accent, #ed0178)" />
              <circle cx="128" cy="58" r="8" fill="var(--app-accent, #ed0178)" opacity="0.85" />
              <circle cx="88" cy="78" r="6" fill="currentColor" opacity="0.35" />
            </svg>
            <p class="visual-caption">[[wiki links]] → graph</p>
          {:else if motif === 'media'}
            <div class="media-deck">
              <div class="media-title">Note · Track</div>
              <div class="media-bars">
                <i></i><i></i><i></i><i></i><i></i><i></i><i></i>
              </div>
            </div>
            <p class="visual-caption">Play Now · Next · Last</p>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</MarketingSection>

<style>
  :global(.spotlight.mkt-section) {
    padding-top: 2.75rem;
    padding-bottom: 2.25rem;
  }
  :global(.spotlight .mkt-eyebrow),
  :global(.spotlight .mkt-title) {
    max-width: 22rem;
  }
  :global(.spotlight.mkt-align-right .mkt-eyebrow),
  :global(.spotlight.mkt-align-right .mkt-title) {
    margin-left: auto;
    text-align: right;
  }
  :global(.spotlight .mkt-title) {
    display: inline-block;
    padding-bottom: 0.12em;
    box-shadow: inset 0 -3px 0 color-mix(in srgb, var(--app-accent, #ed0178) 75%, transparent);
  }
  :global(.spotlight.mkt-align-right .mkt-title) {
    display: block;
    width: fit-content;
    margin-left: auto;
  }

  .spotlight-row {
    display: grid;
    grid-template-columns: 1.05fr 0.95fr;
    gap: 1.75rem 2.25rem;
    align-items: center;
    margin-top: 0.35rem;
  }
  .spotlight-row.row-reverse {
    direction: rtl;
  }
  .spotlight-row.row-reverse > * {
    direction: ltr;
  }
  .spotlight-copy {
    min-width: 0;
  }
  .spotlight-body {
    margin: 0;
    font-size: 1rem;
    line-height: 1.7;
    opacity: 0.68;
  }
  .spotlight-row.row-reverse .spotlight-body {
    text-align: right;
  }

  .spotlight-visual {
    min-width: 0;
  }
  .visual-panel {
    position: relative;
    border-radius: 14px;
    padding: 1.35rem 1.4rem;
    min-height: 148px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.85rem;
    background:
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--app-background, #fff) 82%, transparent),
        color-mix(in srgb, var(--app-background, #fff) 55%, transparent)
      );
    border: 1px solid rgba(255, 255, 255, 0.28);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.35) inset,
      0 22px 48px -28px rgba(0, 0, 0, 0.55),
      0 0 0 1px rgba(0, 0, 0, 0.04);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    overflow: hidden;
  }
  .visual-panel::before {
    content: '';
    position: absolute;
    inset: auto -20% -40% 40%;
    height: 70%;
    background: radial-gradient(
      closest-side,
      color-mix(in srgb, var(--app-accent, #ed0178) 28%, transparent),
      transparent 70%
    );
    pointer-events: none;
  }
  .visual-caption {
    margin: 0;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.5;
  }

  .omni-chrome {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    height: 2.4rem;
    padding: 0 0.85rem;
    border-radius: 8px;
    background: var(--app-omni-background, #d8d8d8);
    border: 1px solid rgba(0, 0, 0, 0.08);
    font-size: 0.85rem;
    z-index: 1;
  }
  .omni-icon {
    opacity: 0.45;
    font-size: 0.95rem;
  }
  .omni-placeholder {
    opacity: 0.45;
  }
  .omni-caret {
    width: 2px;
    height: 1.05rem;
    background: var(--app-accent, #ed0178);
    animation: motif-blink 1.1s steps(1) infinite;
  }
  .omni-hits {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.82rem;
    z-index: 1;
  }
  .omni-hits span {
    padding: 0.35rem 0.55rem;
    border-radius: 5px;
    background: color-mix(in srgb, var(--app-notelist-odd-background, #e9e9e9) 80%, transparent);
  }
  .omni-hit-dim {
    opacity: 0.55;
  }

  .local-stack {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    z-index: 1;
  }
  .local-stack i {
    display: block;
    height: 2rem;
    border-radius: 7px;
    background: color-mix(in srgb, var(--app-accent, #ed0178) 14%, var(--app-background, #fff));
    border: 1px solid color-mix(in srgb, var(--app-accent, #ed0178) 22%, transparent);
  }
  .local-stack i:nth-child(1) {
    width: 100%;
  }
  .local-stack i:nth-child(2) {
    width: 86%;
  }
  .local-stack i:nth-child(3) {
    width: 72%;
  }

  .cal-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 5px;
    z-index: 1;
  }
  .cal-grid i {
    aspect-ratio: 1;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.12);
  }
  .cal-grid i.lit {
    background: color-mix(in srgb, var(--app-accent, #ed0178) 55%, transparent);
  }
  .cal-grid i.now {
    background: var(--app-accent, #ed0178);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--app-accent, #ed0178) 35%, transparent);
  }

  .graph-svg {
    width: 100%;
    max-width: 200px;
    height: auto;
    color: var(--text-color);
    z-index: 1;
    align-self: center;
  }

  .media-deck {
    z-index: 1;
  }
  .media-title {
    font-size: 0.9rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    white-space: nowrap;
    overflow: hidden;
    mask-image: linear-gradient(90deg, #000 70%, transparent);
  }
  .media-bars {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 2.4rem;
  }
  .media-bars i {
    flex: 1;
    border-radius: 2px;
    background: var(--app-accent, #ed0178);
    animation: motif-pulse 1.15s ease-in-out infinite;
  }
  .media-bars i:nth-child(1) {
    height: 35%;
    animation-delay: 0ms;
  }
  .media-bars i:nth-child(2) {
    height: 70%;
    animation-delay: 70ms;
  }
  .media-bars i:nth-child(3) {
    height: 95%;
    animation-delay: 140ms;
  }
  .media-bars i:nth-child(4) {
    height: 55%;
    animation-delay: 210ms;
  }
  .media-bars i:nth-child(5) {
    height: 80%;
    animation-delay: 280ms;
  }
  .media-bars i:nth-child(6) {
    height: 45%;
    animation-delay: 350ms;
  }
  .media-bars i:nth-child(7) {
    height: 65%;
    animation-delay: 420ms;
  }

  @keyframes motif-blink {
    50% {
      opacity: 0;
    }
  }
  @keyframes motif-pulse {
    0%,
    100% {
      transform: scaleY(0.55);
      opacity: 0.5;
    }
    50% {
      transform: scaleY(1);
      opacity: 1;
    }
  }

  @media (prefers-color-scheme: dark) {
    .visual-panel {
      border-color: rgba(255, 255, 255, 0.1);
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.06) inset,
        0 22px 48px -26px rgba(0, 0, 0, 0.75);
    }
    .cal-grid i {
      background: rgba(255, 255, 255, 0.14);
    }
    .omni-chrome {
      border-color: rgba(255, 255, 255, 0.08);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .omni-caret,
    .media-bars i {
      animation: none;
    }
  }

  @media (max-width: 720px) {
    .spotlight-row,
    .spotlight-row.row-reverse {
      grid-template-columns: 1fr;
      direction: ltr;
    }
    :global(.spotlight.mkt-align-right .mkt-eyebrow),
    :global(.spotlight.mkt-align-right .mkt-title),
    .spotlight-row.row-reverse .spotlight-body {
      text-align: center;
      margin-left: auto;
      margin-right: auto;
    }
    :global(.spotlight.mkt-align-right .mkt-title) {
      margin-left: auto;
      margin-right: auto;
    }
    .visual-panel {
      min-height: 132px;
    }
  }
</style>
