<script>
  import AbstractlyLogo from './AbstractlyLogo.svelte';
  import { fullScreen, windowed } from './store';

  function enterAppMode() {
    $fullScreen = true;
    $windowed = false;
  }
</script>

<section class="demo-marketing w-full flex flex-col items-center">
  <div class="demo-section text-center">
    <h2>Features</h2>
    <ul class="feature-list">
      <li>
        <strong>Speed of thought</strong>
        <span>Capture and retrieve ideas without leaving the zone — Omnibar-first, keyboard-native.</span>
      </li>
      <li>
        <strong>Local-first PWA</strong>
        <span>Your notes live in the browser. Offline-capable, no account required, single-file deployable.</span>
      </li>
      <li>
        <strong>Life Calendar &amp; wiki links</strong>
        <span>See your weeks at a glance, and connect notes with <code>[[wiki-style]]</code> links.</span>
      </li>
    </ul>
  </div>

  <div class="demo-section text-center">
    <h2>How it works</h2>
    <ol class="steps">
      <li><span class="step-num">1</span> Type in the Omnibar to search or start a note.</li>
      <li><span class="step-num">2</span> The list filters as you type — click or arrow to open.</li>
      <li><span class="step-num">3</span> Press Enter to create when nothing matches.</li>
    </ol>
  </div>

  <div class="demo-section text-center cta-section">
    <h2>Ready to go full screen?</h2>
    <p class="cta-copy">
      Enter App Mode for an edge-to-edge workspace. You can always minimize back to Demo from the Omnibar.
    </p>
    <button type="button" class="cta-btn" onclick={enterAppMode}>
      Try App Mode
    </button>
    <p class="credit">
      <span>Designed and Built by</span>
      <a href="https://abstractly.io" target="_blank" rel="noopener noreferrer" class="credit-logo">
        <AbstractlyLogo />
      </a>
      <span>The Human Interface Company.</span>
    </p>
    <p class="github">
      Hack on
      <a href="https://github.com/matterofabstract/nvaux" target="_blank" rel="noopener noreferrer">
        nvAux @ GitHub
      </a>
    </p>
  </div>
</section>

<style>
  .demo-marketing {
    color: inherit;
    padding: 0 1.25rem 4rem;
  }
  .demo-section {
    width: 100%;
    max-width: 540px;
    padding: 4rem 0 2rem;
  }
  h2 {
    font-size: 1.35rem;
    font-weight: 600;
    margin: 0 0 1.5rem;
    opacity: 0.9;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  }
  .feature-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    text-align: left;
  }
  .feature-list li {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .feature-list strong {
    font-size: 0.95rem;
    opacity: 0.85;
  }
  .feature-list span {
    font-size: 0.9rem;
    line-height: 1.55;
    opacity: 0.6;
  }
  .feature-list code {
    font-size: 0.85em;
    opacity: 0.9;
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    text-align: left;
    font-size: 0.9rem;
    line-height: 1.55;
    opacity: 0.7;
  }
  .steps li {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .step-num {
    flex-shrink: 0;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.12);
    opacity: 0.9;
  }
  .cta-copy {
    margin: 0 0 1.5rem;
    font-size: 0.9rem;
    line-height: 1.55;
    opacity: 0.6;
  }
  .cta-btn {
    appearance: none;
    border: 1px solid rgba(0, 0, 0, 0.18);
    background: var(--app-background, #fff);
    color: inherit;
    border-radius: 6px;
    padding: 0.7rem 1.4rem;
    font-size: 0.9rem;
    font-weight: 600;
    box-shadow: 0 8px 24px -12px rgba(0, 0, 0, 0.45);
    transition: opacity 150ms ease, transform 150ms ease;
  }
  .cta-btn:hover {
    opacity: 0.92;
  }
  .cta-btn:active {
    transform: translateY(1px);
  }
  .credit {
    margin: 3rem 0 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    font-size: 11px;
    color: #5c6269;
  }
  .credit-logo {
    display: inline-flex;
    align-items: center;
    height: 30px;
    width: 80px;
    position: relative;
    top: 2px;
  }
  .github {
    margin: 1.25rem 0 0;
    font-size: 12px;
    color: #5c6269;
  }
  .github a {
    color: var(--app-accent);
    text-decoration: underline;
  }
</style>
