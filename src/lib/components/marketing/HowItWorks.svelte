<script>
  import MarketingSection from './MarketingSection.svelte';

  const steps = [
    { title: 'Type', body: 'Type in the Omnibar — the list narrows as you go.' },
    { title: 'Open', body: 'Arrow or click to open what already exists.' },
    { title: 'Create', body: 'Press Enter on a new name — that is the note.' },
  ];
</script>

<MarketingSection
  eyebrow="How it works"
  title="Search and create are the same gesture"
  wide
  className="how"
>
  <ol class="steps">
    {#each steps as step, i (i)}
      <li>
        <span class="step-num">{i + 1}</span>
        <div class="step-copy">
          <strong>{step.title}</strong>
          <span>{step.body}</span>
        </div>
      </li>
    {/each}
  </ol>
</MarketingSection>

<style>
  :global(.how.mkt-section) {
    max-width: 100%;
    padding-top: 3.5rem;
  }
  .steps {
    list-style: none;
    margin: 2rem 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }
  .steps li {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    text-align: left;
    padding: 1.35rem 1.25rem 1.4rem;
    border-radius: 14px;
    background:
      linear-gradient(
        160deg,
        color-mix(in srgb, var(--app-background, #fff) 78%, transparent),
        color-mix(in srgb, var(--app-background, #fff) 48%, transparent)
      );
    border: 1px solid rgba(255, 255, 255, 0.26);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 18px 40px -28px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .step-num {
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 0.95rem;
    font-weight: 700;
    color: #fff;
    background: var(--app-accent, #ed0178);
    box-shadow: 0 8px 20px -10px color-mix(in srgb, var(--app-accent, #ed0178) 90%, transparent);
  }
  .step-copy {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .step-copy strong {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 1.05rem;
    font-weight: 700;
    opacity: 0.92;
  }
  .step-copy span {
    font-size: 0.9rem;
    line-height: 1.55;
    opacity: 0.62;
  }

  @media (prefers-color-scheme: dark) {
    .steps li {
      border-color: rgba(255, 255, 255, 0.1);
    }
  }

  @media (max-width: 720px) {
    .steps {
      grid-template-columns: 1fr;
      max-width: 24rem;
      margin-left: auto;
      margin-right: auto;
    }
  }
</style>
