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
    <h2>Built like a tool. Feels like a studio.</h2>
    <p class="section-copy">
      nvAux is a local-first note app with the precision of a command palette and the energy of a
      media deck. One Omnibar. Persistent sessions. Floating windows when you want them. An early
      product with a long runway — and a clear point of view.
    </p>
  </div>

  <div class="demo-section text-center">
    <h2>The first lifetime-aware note app</h2>
    <p class="section-copy">
      Life Calendar lays out every week you have lived and every week still ahead. Your meta sits
      inside the span of a life — not a folder tree, not a blank archive. Time is the organizing
      principle.
    </p>
  </div>

  <div class="demo-section text-center">
    <h2>A note can be anything</h2>
    <ul class="feature-list">
      <li>
        <strong>Prose, code, and wiki links</strong>
        <span>
          Markdown when you need it. <code>[[wiki-style]]</code> titles when ideas should wire
          together.
        </span>
      </li>
      <li>
        <strong>A media deck under the Omnibar</strong>
        <span>
          Queue SoundCloud from any note. Keep the session playing while you write, search, and
          switch.
        </span>
      </li>
      <li>
        <strong>Chrome that moves with you</strong>
        <span>
          Demo, fullscreen, windowed — same notes, different frames. Pop out editors when one pane
          is not enough.
        </span>
      </li>
    </ul>
  </div>

  <div class="demo-section text-center">
    <h2>Search and create are the same gesture</h2>
    <ol class="steps">
      <li><span class="step-num">1</span> Type in the Omnibar — the list narrows as you go.</li>
      <li><span class="step-num">2</span> Arrow or click to open what already exists.</li>
      <li><span class="step-num">3</span> Press Enter on a new name — that is the note.</li>
    </ol>
  </div>

  <div class="demo-section text-center cta-section">
    <h2>Take the full surface</h2>
    <p class="cta-copy">
      App Mode fills the viewport. Minimize from the Omnibar anytime to return here.
    </p>
    <button type="button" class="cta-btn" onclick={enterAppMode}>
      Enter App Mode
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
  .section-copy {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.6;
    opacity: 0.65;
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
    transition:
      opacity 150ms ease,
      transform 150ms ease;
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
