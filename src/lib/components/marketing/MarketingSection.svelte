<script>
  /**
   * Shared marketing section shell with one-shot scroll reveal.
   * @type {{
   *   children?: import('svelte').Snippet,
   *   eyebrow?: string,
   *   title?: string,
   *   lead?: string,
   *   align?: 'center' | 'left' | 'right',
   *   wide?: boolean,
   *   tight?: boolean,
   *   className?: string,
   * }}
   */
  let {
    children,
    eyebrow = '',
    title = '',
    lead = '',
    align = 'center',
    wide = false,
    tight = false,
    className = '',
  } = $props();

  let visible = $state(false);

  /**
   * @param {HTMLElement} node
   * @returns {Element | null}
   */
  function findScrollRoot(node) {
    let el = node.parentElement;
    while (el && el !== document.documentElement) {
      const { overflowY } = getComputedStyle(el);
      if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  /**
   * @param {HTMLElement} node
   * @returns {void | (() => void)}
   */
  function reveal(node) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      visible = true;
      return;
    }

    const root = findScrollRoot(node);
    const rootRect = root
      ? root.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight };
    const rect = node.getBoundingClientRect();
    // Show immediately when already in the first viewport (marketing peek).
    if (rect.top < rootRect.bottom - 8 && rect.bottom > rootRect.top + 8) {
      visible = true;
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          visible = true;
          io.disconnect();
        }
      },
      { root, threshold: 0.06, rootMargin: '0px 0px -16px 0px' }
    );
    io.observe(node);
    return () => io.disconnect();
  }
</script>

<section
  {@attach reveal}
  class="mkt-section {className}"
  class:mkt-wide={wide}
  class:mkt-tight={tight}
  class:mkt-align-left={align === 'left'}
  class:mkt-align-right={align === 'right'}
  class:mkt-visible={visible}
>
  {#if eyebrow}
    <p class="mkt-eyebrow">{eyebrow}</p>
  {/if}
  {#if title}
    <h2 class="mkt-title text-pretty">{title}</h2>
  {/if}
  {#if lead}
    <p class="mkt-lead">{lead}</p>
  {/if}
  {@render children?.()}
</section>

<style>
  .mkt-section {
    width: 100%;
    max-width: 680px;
    padding: 3.25rem 0 2rem;
    opacity: 0;
    transform: translateY(22px);
    transition:
      opacity 560ms cubic-bezier(0.22, 1, 0.36, 1),
      transform 560ms cubic-bezier(0.22, 1, 0.36, 1);
    align-self: center;
    position: relative;
  }
  .mkt-section.mkt-wide {
    max-width: 100%;
  }
  .mkt-section.mkt-tight {
    padding-top: 0.65rem;
  }
  .mkt-section.mkt-visible {
    opacity: 1;
    transform: translateY(0);
  }
  .mkt-align-left {
    text-align: left;
  }
  .mkt-align-right {
    text-align: left;
  }
  .mkt-section:not(.mkt-align-left):not(.mkt-align-right) {
    text-align: center;
  }
  .mkt-eyebrow {
    margin: 0 0 0.75rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--app-accent, #ed0178);
  }
  .mkt-title {
    margin: 0 0 1rem;
    font-family: Arial, Helvetica, sans-serif;
    font-size: clamp(1.85rem, 4.2vw, 2.55rem);
    font-weight: 700;
    line-height: 1.12;
    letter-spacing: -0.02em;
    opacity: 0.95;
    text-shadow: 0 2px 18px rgba(0, 0, 0, 0.18);
  }
  .mkt-lead {
    margin: 0 auto;
    max-width: 36rem;
    font-size: 1.05rem;
    line-height: 1.7;
    opacity: 0.68;
  }
  .mkt-align-left .mkt-lead,
  .mkt-align-right .mkt-lead {
    margin-left: 0;
    margin-right: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .mkt-section {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }

  @media (max-width: 720px) {
    .mkt-section {
      padding: 2.75rem 0 1.75rem;
    }
  }
</style>
