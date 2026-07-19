<script>
  import AbstractlyLogo from '$lib/settings/AbstractlyLogo.svelte';
</script>

<footer class="mkt-footer">
  <div class="footer-rule" aria-hidden="true"></div>
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
</footer>

<style>
  .mkt-footer {
    width: 100%;
    max-width: 640px;
    padding: 2.75rem 0 1.25rem;
    text-align: center;
  }
  .footer-rule {
    width: 100%;
    max-width: 12rem;
    height: 1px;
    margin: 0 auto 1.75rem;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, var(--app-accent, #ed0178) 55%, rgba(0, 0, 0, 0.2)),
      transparent
    );
  }
  .credit {
    margin: 0;
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
    text-underline-offset: 2px;
  }

  @media (prefers-color-scheme: dark) {
    .credit,
    .github {
      color: #9aa1a9;
    }
  }
</style>
