<script>
  import { sidebarOpen, sidebarWidth } from './store';
  import LifeCalendar from './LifeCalendar.svelte';
  import ResizeHandle from './ResizeHandle.svelte';

  const MIN_MAIN_CONTENT = 280;

  function getSidebarMax() {
    return Math.max(480, window.innerWidth - MIN_MAIN_CONTENT);
  }
</script>

<aside
  class="sidebar flex-grow-0 flex-shrink-0 relative h-full"
  class:open={$sidebarOpen}
  aria-hidden={!$sidebarOpen}
  style="width: {$sidebarOpen ? $sidebarWidth : 0}px; overflow: {$sidebarOpen ? 'visible' : 'hidden'};"
>
  <div
    class="sidebar-inner h-full overflow-hidden"
    style="width: {$sidebarWidth}px;"
  >
    <LifeCalendar />
  </div>
  {#if $sidebarOpen}
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
</style>
