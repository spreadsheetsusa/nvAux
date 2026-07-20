<script>
  import { fly } from 'svelte/transition';

  const TAGLINES = [
    "Notes that help you build across your life's work.",
    'Capture everything. Map it to a life.',
    'Your notes, ordered by the weeks you lived them.',
    'A notebook that remembers when — and why.',
    'Write freely. See the shape of a life.',
    'Notes for the long arc, not just today.',
    'Hold ideas. Hold a lifetime of them.',
    "From fleeting thoughts to a life's archive.",
    'Where notes meet the calendar of your life.',
    'Build, note by note, across the years.',
    'The multi-tool note-taking app for creative professionals that works at the speed of thought.',
  ];

  let index = $state(Math.floor(Math.random() * TAGLINES.length));

  function cycle() {
    let next = index;
    while (next === index) {
      next = Math.floor(Math.random() * TAGLINES.length);
    }
    index = next;
  }
</script>

<button
  type="button"
  class="hero-tagline relative overflow-hidden"
  aria-live="polite"
  onclick={cycle}
>
  {#key index}
    <span
      class="hero-tagline-text text-balance"
      in:fly={{ y: 28, duration: 320 }}
      out:fly={{ y: -28, duration: 320 }}
    >
      {TAGLINES[index]}
    </span>
  {/key}
</button>

<style>
  .hero-tagline {
    appearance: none;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    display: grid;
    justify-items: stretch;
    margin: 0 auto;
    max-width: 540px;
    width: 100%;
    min-height: 48px;
    padding: 0 20px;
    font-size: 15px;
    line-height: 24px;
    text-align: center;
    opacity: 0.6;
    cursor: pointer;
  }
  .hero-tagline-text {
    grid-area: 1 / 1;
    display: block;
    width: 100%;
  }
</style>
