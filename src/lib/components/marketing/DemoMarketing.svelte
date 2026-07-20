<script>
  import MarketingManifesto from './MarketingManifesto.svelte';
  import FeatureSpotlight from './FeatureSpotlight.svelte';
  import HowItWorks from './HowItWorks.svelte';
  import AppModeCta from './AppModeCta.svelte';
  import MarketingFooter from './MarketingFooter.svelte';
</script>

<section class="demo-marketing w-full flex flex-col items-center">
  <MarketingManifesto />

  <FeatureSpotlight
    eyebrow="Omnibar"
    title="Search and create are the same gesture"
    body="Type once. The list filters as you go. Arrow or click to open what already exists. Press Enter on a new name — that is the note. Same keystroke, zero ceremony."
    align="left"
    motif="omnibar"
  />

  <FeatureSpotlight
    eyebrow="Local-first"
    title="Your vault. Your browser. Done."
    body="Notes live encrypted at rest in IndexedDB on your machine. No account. No sync tax. Install it as a PWA and it keeps working when the Wi‑Fi doesn't."
    align="right"
    motif="local"
  />

  <FeatureSpotlight
    eyebrow="Life Calendar"
    title="The first lifetime-aware note app"
    body="Life Calendar lays out every week you have lived and every week still ahead. Your notes sit inside the span of a life — not a folder tree, not a blank archive. Time is the organizing principle."
    align="left"
    motif="calendar"
  />

  <FeatureSpotlight
    eyebrow="Wiki links"
    title="A note can be anything"
    body="Markdown when you need it. Write [[like this]] and notes become a web. Open Graph View when you want the big picture — force-directed, clickable, no plugin zoo."
    align="right"
    motif="graph"
  />

  <FeatureSpotlight
    eyebrow="Media session"
    title="A media deck under the Omnibar"
    body="Queue SoundCloud or video from any note — Play Now, Play Next, Add Last — and keep writing, searching, and switching while the session rides under the Omnibar until you close it."
    align="left"
    motif="media"
  />

  <HowItWorks />
  <AppModeCta />
  <MarketingFooter />
</section>

<style>
  .demo-marketing {
    color: inherit;
    width: 100%;
    max-width: 880px;
    padding: 0.5rem 1.35rem 5rem;
    position: relative;
  }
</style>
