<script>
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { sidebarOpen, sidebarWidth, isMobile, graphViewOpen } from '$lib/store';
  import LifeCalendar from '$lib/life/LifeCalendar.svelte';
  import NoteGraphView from '$lib/graph/NoteGraphView.svelte';
  import ResizeHandle from './ResizeHandle.svelte';

  const GRAPH_SLIDE = { duration: 250, easing: cubicOut };

  const MIN_MAIN_CONTENT = 280;
  /** Leave a peek of the main app — classic iOS drawer / tap-to-dismiss strip. */
  const DRAWER_PEEK_PX = 36;

  function getSidebarMax() {
    return Math.max(480, window.innerWidth - MIN_MAIN_CONTENT);
  }

  /** Visible CSS px — prefer visualViewport (iOS layout/dvw often overshoots). */
  function readViewportWidth() {
    return Math.round(window.visualViewport?.width ?? window.innerWidth);
  }

  let viewportWidth = $state(
    typeof window !== 'undefined' ? readViewportWidth() : 390
  );

  onMount(() => {
    const sync = () => {
      viewportWidth = readViewportWidth();
    };
    sync();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    return () => {
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  });

  let drawer = $derived($isMobile);
  let open = $derived($sidebarOpen);
  let drawerWidthPx = $derived(Math.max(200, viewportWidth - DRAWER_PEEK_PX));
  let panelWidth = $derived(drawer ? `${drawerWidthPx}px` : `${$sidebarWidth}px`);
  let desktopWidthPx = $derived(open ? $sidebarWidth : 0);
</script>

<aside
  class="sidebar flex-grow-0 flex-shrink-0 relative h-full"
  class:open
  class:drawer
  aria-hidden={!open}
  style={drawer
    ? `--sidebar-panel-width: ${panelWidth}; --drawer-peek: ${DRAWER_PEEK_PX}px;`
    : `width: ${desktopWidthPx}px; overflow: hidden; --sidebar-panel-width: ${panelWidth};`}
>
  <div
    class="sidebar-inner h-full overflow-hidden flex flex-col"
    style="width: var(--sidebar-panel-width);"
  >
    <div class="sidebar-calendar flex-1 min-h-0 overflow-hidden">
      <LifeCalendar />
    </div>
    {#if $graphViewOpen}
      <div class="sidebar-graph flex-shrink-0" transition:slide={GRAPH_SLIDE}>
        <NoteGraphView />
      </div>
    {/if}
  </div>
</aside>
{#if !drawer}
  <!-- Sibling of aside (and of .main-content) so the handle can sit above main
       without raising the whole sidebar stacking context. -->
  <div
    class="sidebar-resize-layer"
    style="width: {desktopWidthPx}px;"
    aria-hidden={!open}
  >
    {#if open}
      <ResizeHandle
        orientation="horizontal"
        bind:value={$sidebarWidth}
        min={160}
        max={1200}
        getMax={getSidebarMax}
        ariaLabel="Resize sidebar"
      />
    {/if}
  </div>
{/if}

<style>
  .sidebar {
    /* Under .main-content (z-index: 1) so slide/expand content stays beneath. */
    z-index: 0;
    background-color: var(--app-statusbar-background);
    border-right: 1px solid transparent;
    transition: width 300ms ease, border-color 300ms ease;
  }

  .sidebar.open {
    border-right-color: var(--app-statusbar-border);
  }

  .sidebar-resize-layer {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    z-index: 2;
    pointer-events: none;
    transition: width 300ms ease;
  }

  .sidebar-resize-layer :global(.resize-handle) {
    pointer-events: auto;
  }

  /* Mobile: overlay drawer above dimmed main; peek strip keeps backdrop tappable. */
  .sidebar.drawer {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 0 !important;
    overflow: visible;
    z-index: 50;
    background: transparent;
    border-right: none;
    transition: none;
    pointer-events: none;
  }

  .sidebar.drawer .sidebar-inner {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    height: 100%;
    /* Cap against the layout viewport too — visualViewport/dvw can disagree on iOS. */
    max-width: calc(100% - var(--drawer-peek, 36px));
    padding-left: env(safe-area-inset-left, 0px);
    background-color: var(--app-statusbar-background);
    border-right: 1px solid var(--app-statusbar-border);
    box-shadow: 8px 0 28px rgba(0, 0, 0, 0.35);
    transform: translateX(-100%);
    transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
    pointer-events: none;
    z-index: 51;
  }

  .sidebar.drawer.open .sidebar-inner {
    transform: translateX(0);
    pointer-events: auto;
  }
</style>
