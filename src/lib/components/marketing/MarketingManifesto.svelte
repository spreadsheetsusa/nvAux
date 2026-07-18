<script>
  import MarketingSection from './MarketingSection.svelte';
</script>

<MarketingSection
  tight
  className="manifesto"
  title="Notes that get out of the way."
  lead="nvAux is built for the moment before the idea evaporates — when you're in the zone and the last thing you need is another login screen. Capture fast. Find it faster. Stay there."
>
  <div class="manifesto-rule" aria-hidden="true"></div>
</MarketingSection>

<style>
  :global(.manifesto.mkt-section) {
    max-width: 42rem;
  }
  :global(.manifesto .mkt-title) {
    font-size: clamp(2.1rem, 5vw, 3rem);
    line-height: 1.05;
  }
  :global(.manifesto .mkt-lead) {
    font-size: 1.08rem;
  }
  .manifesto-rule {
    width: 4.5rem;
    height: 3px;
    margin: 1.75rem auto 0;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--app-accent, #ed0178) 20%,
      var(--app-accent, #ed0178) 80%,
      transparent
    );
    box-shadow: 0 0 18px color-mix(in srgb, var(--app-accent, #ed0178) 55%, transparent);
  }
</style>
