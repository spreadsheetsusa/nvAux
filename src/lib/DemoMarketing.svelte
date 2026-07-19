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
    <h2>A note app with session energy</h2>
    <p class="section-copy">
      nvAux is a local-first PWA for the browser: Omnibar-precise when you want an instrument,
      deck-like when a note becomes a media session. Early build. Clear aim. Room to grow.
    </p>
  </div>

  <div class="demo-section text-center">
    <h2>Your life, measured in weeks</h2>
    <p class="section-copy">
      Life Calendar is the first lifetime-aware surface in a note app — every week you have lived,
      and every week still ahead, laid out so your notes sit inside a life, not a folder tree.
    </p>
  </div>

  <div class="demo-section text-center">
    <h2>Notes that hold more than text</h2>
    <ul class="feature-list">
      <li>
        <strong>Markdown &amp; wiki links</strong>
        <span>Write in prose, fence code, wire ideas with <code>[[wiki-style]]</code> titles.</span>
      </li>
      <li>
        <strong>Media sessions</strong>
        <span>SoundCloud and playlist notes keep playing while you move — a deck under the Omnibar.</span>
      </li>
      <li>
        <strong>Workspace chrome</strong>
        <span>Settings, popout editors, Demo and App Mode — the same note model, different frames.</span>
      </li>
    </ul>
  </div>

  <div class="demo-section text-center">
    <h2>One field. Search and create.</h2>
    <ol class="steps">
      <li><span class="step-num">1</span> Type in the Omnibar — the list narrows as you go.</li>
      <li><span class="step-num">2</span> Arrow or click to open what already exists.</li>
      <li><span class="step-num">3</span> Hit Enter on a new name — that is the note.</li>
    </ol>
  </div>

  <div class="demo-section text-center cta-section">
    <h2>Go edge to edge</h2>
    <p class="cta-copy">
      App Mode fills the viewport. Minimize from the Omnibar anytime to return here.
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
