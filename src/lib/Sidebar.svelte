<script>
  import { sidebarOpen, sidebarWidth, isMobile } from './store';
  import LifeCalendar from './LifeCalendar.svelte';
  import ResizeHandle from './ResizeHandle.svelte';

  const MIN_MAIN_CONTENT = 280;
  /** Leave a peek of the main app — classic iOS drawer. */
  const DRAWER_PEEK_PX = 44;

  function getSidebarMax() {
    return Math.max(480, window.innerWidth - MIN_MAIN_CONTENT);
  }

  let drawer = $derived($isMobile);
  let open = $derived($sidebarOpen);
  let panelWidth = $derived(
    drawer ? `calc(100dvw - ${DRAWER_PEEK_PX}px)` : `${$sidebarWidth}px`
  );
</script>

<aside
  class="sidebar flex-grow-0 flex-shrink-0 relative h-full"
  class:open
  class:drawer
  aria-hidden={!open}
  style={drawer
    ? `--sidebar-panel-width: ${panelWidth};`
    : `width: ${open ? $sidebarWidth : 0}px; overflow: ${open ? 'visible' : 'hidden'}; --sidebar-panel-width: ${panelWidth};`}
>
  <div class="sidebar-inner h-full overflow-hidden" style="width: var(--sidebar-panel-width);">
    <LifeCalendar />
  </div>
  {#if open && !drawer}
    <ResizeHandle
      orientation="horizontal"
      bind:value={$sidebarWidth}
      min={160}
      max={1200}
      getMax={getSidebarMax}
      ariaLabel="Resize sidebar"
    />
  {/if}
</aside>

<style>
  .sidebar {
    z-index: 0;
    background-color: var(--app-statusbar-background);
    border-right: 1px solid transparent;
    transition: width 300ms ease, border-color 300ms ease;
  }

  .sidebar.open {
    border-right-color: var(--app-statusbar-border);
  }

  /* Mobile: iOS-style overlay drawer (does not consume flex width). */
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
    left: 0;
    bottom: 0;
    height: 100%;
    max-width: 100dvw;
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
