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
    title="Search is create."
    body="Type once. The list filters as you go. Hit Enter and a new note is born. Same keystroke, zero ceremony — the Notational Velocity spirit, in the browser."
    align="left"
    motif="omnibar"
  />

  <FeatureSpotlight
    eyebrow="Local-first"
    title="Your vault. Your browser. Done."
    body="Notes live in IndexedDB on your machine. No account. No sync tax. Install it as a PWA and it keeps working when the Wi‑Fi doesn't."
    align="right"
    motif="local"
  />

  <FeatureSpotlight
    eyebrow="Life Calendar"
    title="See your weeks. All of them."
    body="A grid of your life — past, now, future. Zoom into a week and find the notes that lived there. Time isn't a sidebar afterthought; it's the map."
    align="left"
    motif="calendar"
  />

  <FeatureSpotlight
    eyebrow="Wiki links"
    title="Connect the dots. Or stare at the map."
    body="Write [[like this]] and notes become a web. Open Graph View when you want the big picture — force-directed, clickable, no plugin zoo."
    align="right"
    motif="graph"
  />

  <FeatureSpotlight
    eyebrow="Media session"
    title="Notes that keep the beat."
    body="Queue SoundCloud from a note — Play Now, Play Next, Add Last — and keep writing while the player rides under the Omnibar. The session stays until you close it."
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
