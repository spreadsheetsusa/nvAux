<script>
  import MarketingSection from './MarketingSection.svelte';
  import { fullScreen, windowed } from '$lib/store';

  function enterAppMode() {
    $fullScreen = true;
    $windowed = false;
  }
</script>

<MarketingSection wide className="cta" eyebrow="Modes" title="Take the full surface">
  <p class="cta-copy">
    App Mode fills the viewport. Windowed floats a resizable workspace — flip that in Settings.
    Minimize from the Omnibar anytime to return here.
  </p>
  <button type="button" class="cta-btn" onclick={enterAppMode}>Enter App Mode</button>
</MarketingSection>

<style>
  :global(.cta.mkt-section) {
    max-width: 40rem;
    padding: 3.5rem 1.5rem 2.5rem;
    margin-top: 1rem;
    border-radius: 18px;
    background:
      linear-gradient(
        155deg,
        color-mix(in srgb, var(--app-background, #fff) 88%, transparent),
        color-mix(in srgb, var(--app-accent, #ed0178) 10%, var(--app-background, #fff) 55%)
      );
    border: 1px solid color-mix(in srgb, var(--app-accent, #ed0178) 22%, rgba(255, 255, 255, 0.25));
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.35) inset,
      0 28px 60px -32px rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  .cta-copy {
    margin: 0 auto;
    max-width: 32rem;
    font-size: 1rem;
    line-height: 1.65;
    opacity: 0.68;
  }
  .cta-btn {
    appearance: none;
    margin-top: 1.75rem;
    border: none;
    background: var(--app-accent, #ed0178);
    color: #fff;
    border-radius: 8px;
    padding: 0.85rem 1.7rem;
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    box-shadow:
      0 12px 28px -12px color-mix(in srgb, var(--app-accent, #ed0178) 85%, transparent),
      0 1px 0 rgba(255, 255, 255, 0.2) inset;
    transition:
      transform 150ms ease,
      box-shadow 150ms ease,
      filter 150ms ease;
  }
  .cta-btn:hover {
    filter: brightness(1.05);
    box-shadow:
      0 16px 34px -12px color-mix(in srgb, var(--app-accent, #ed0178) 90%, transparent),
      0 1px 0 rgba(255, 255, 255, 0.25) inset;
  }
  .cta-btn:active {
    transform: translateY(1px);
  }

  @media (prefers-color-scheme: dark) {
    :global(.cta.mkt-section) {
      border-color: color-mix(in srgb, var(--app-accent, #ed0178) 28%, rgba(255, 255, 255, 0.08));
    }
  }
</style>
