<script>
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';

  import OmniBar from './lib/OmniBar.svelte';
  import NoteList from './lib/NoteList.svelte';
  import ResizeHandle from './lib/ResizeHandle.svelte';
  import NoteDetail from './lib/NoteDetail.svelte';
  import StatusBar from './lib/StatusBar.svelte';
  import AudioPlayer from './lib/AudioPlayer.svelte';
  import Sidebar from './lib/Sidebar.svelte';
  import NotePopupWindow from './lib/NotePopupWindow.svelte';
  import DemoMarketing from './lib/DemoMarketing.svelte';

  import {
    fullScreen,
    windowed,
    sidebarOpen,
    sidebarWidth,
    noteListHeight,
    noteListHeightHasStore,
    persistNoteListHeight,
    mediaPlayerHeight,
    notePopups,
    closeAllNotePopups,
    showStatusBar,
    mainWindowZIndex,
    raiseMainWindow,
    isMobile,
  } from './lib/store';
  import { windowFrame } from './utils/windowFrame';

  /** Chrome below/above the note list excluding the status bar (OmniBar, handle, margins). */
  const LIST_CHROME_BASE_PX = 65;
  /** Status bar height used when reserving space for NoteDetail clamping. */
  const STATUS_BAR_CHROME_PX = 35;
  /** Minimum NoteDetail viewport so body content is never pushed past the fold. */
  const NOTE_DETAIL_MIN_PX = 120;
  const NOTE_LIST_MIN_PX = 60;
  /** First-layout default: half of list+detail available space. */
  const NOTE_LIST_DEFAULT_RATIO = 0.5;

  let mainContent = $state(null);
  /** User/preferred height; null until first layout chooses a default. */
  let preferredNoteListHeight = $state(
    noteListHeightHasStore ? get(noteListHeight) : null
  );
  /** True after a stored preference exists or first-layout default was written. */
  let noteListDefaultApplied = $state(noteListHeightHasStore);

  let isDemo = $derived(!$fullScreen);
  let isAppWindowed = $derived($fullScreen && $windowed && !$isMobile);
  let isAppFullscreen = $derived($fullScreen && (!$windowed || $isMobile));
  /** Desktop sidebar expands the window; mobile uses an overlay drawer. */
  let layoutSidebarOpen = $derived($sidebarOpen && !$isMobile);
  let listChromePx = $derived(
    LIST_CHROME_BASE_PX + ($showStatusBar ? STATUS_BAR_CHROME_PX : 0)
  );

  // Popups are Windowed-only — close all when leaving App Windowed.
  $effect(() => {
    if (!isAppWindowed) closeAllNotePopups();
  });

  function getNoteListMax() {
    if (!mainContent) return 600;
    const reserved = listChromePx + NOTE_DETAIL_MIN_PX + $mediaPlayerHeight;
    return Math.max(NOTE_LIST_MIN_PX, mainContent.clientHeight - reserved);
  }

  /**
   * Apply note-list height for the current layout.
   * Preferred height is persisted; temporary clamp-downs are display-only.
   */
  function applyNoteListHeight() {
    if (!mainContent || mainContent.clientHeight <= 0) return;

    const max = getNoteListMax();
    const available =
      mainContent.clientHeight - listChromePx - $mediaPlayerHeight;

    if (!noteListDefaultApplied) {
      // First open: once layout has a real size, pick a default and persist it.
      const preferred = Math.round(
        Math.min(
          max,
          Math.max(NOTE_LIST_MIN_PX, available * NOTE_LIST_DEFAULT_RATIO)
        )
      );
      preferredNoteListHeight = preferred;
      noteListHeight.set(preferred);
      persistNoteListHeight(preferred);
      noteListDefaultApplied = true;
      return;
    }

    // Preferred exists: clamp display only — do not overwrite preferred/localStorage.
    const display = Math.max(
      NOTE_LIST_MIN_PX,
      Math.min(preferredNoteListHeight ?? max, max)
    );
    if (get(noteListHeight) !== display) {
      noteListHeight.set(display);
    }
  }

  function onNoteListUserChange(height) {
    preferredNoteListHeight = height;
    persistNoteListHeight(height);
    noteListDefaultApplied = true;
  }

  // Keep NoteDetail on-screen when the app window (or media chrome) shrinks.
  $effect(() => {
    const el = mainContent;
    // Re-run when media player / status bar chrome changes reserved space.
    void $mediaPlayerHeight;
    void listChromePx;
    if (!el) return;

    applyNoteListHeight();
    const ro = new ResizeObserver(() => applyNoteListHeight());
    ro.observe(el);
    return () => ro.disconnect();
  });

  onMount(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          registration.addEventListener("updatefound", () => {
            // If updatefound is fired, it means that there's
            // a new service worker being installed.
            const installingWorker = registration.installing;
            console.log(
              "A new service worker is being installed:",
              installingWorker,
            );

            // You can listen for changes to the installing service worker's
            // state via installingWorker.onstatechange
          });
        })
        .catch((error) => {
          console.error(`Service worker registration failed: ${error}`);
        });
    } else {
      console.error("Service workers are not supported.");
    }
  });
</script>

<div
  class="w-screen flex flex-col items-center transition-all {isDemo
    ? 'min-h-screen overflow-y-auto'
    : 'h-screen overflow-hidden justify-center'} {isAppFullscreen ? '' : 'p-2'}"
  style={!isAppFullscreen
    ? 'padding-top: max(0.5rem, env(safe-area-inset-top, 0px)); padding-bottom: max(0.5rem, env(safe-area-inset-bottom, 0px));'
    : undefined}
>
  <div
    class="w-full flex flex-col justify-center items-center"
    class:demo-stage={isDemo}
    class:h-full={!isDemo}
  >
    <div
      class="demo-hero transition-all text-center"
      class:demo-hero-visible={isDemo}
      class:demo-hero-hidden={!isDemo}
    >
      <div style="perspective: {isDemo ? '150' : '0'}px;" class="transition-all">
        <h1 style="opacity: 0.9; text-shadow: 1px 3px 5px rgba(0,0,0,0.5); transform: rotateX(6deg) rotateY(0deg); transform-style: preserve-3d;">nvAux</h1>
      </div>
      <p>Notes that hold anything. A calendar that holds a life.</p>
    </div>

    {#if $isMobile && $sidebarOpen}
      <button
        type="button"
        class="sidebar-backdrop"
        aria-label="Close sidebar"
        onclick={() => ($sidebarOpen = false)}
      ></button>
    {/if}

    {#if $isMobile}
      <Sidebar />
    {/if}

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <main
      use:windowFrame={{ enabled: isAppWindowed, threshold: 2 }}
      class="{isAppFullscreen ? 'fullscreen' : 'windowed'} relative overflow-hidden flex transition-all"
      class:sidebar-open={layoutSidebarOpen}
      style="background-color: var(--app-background); --sidebar-width: {$sidebarWidth}px;"
      style:z-index={isAppWindowed ? $mainWindowZIndex : undefined}
      onpointerdown={() => {
        if (isAppWindowed) raiseMainWindow();
      }}
    >
      {#if !$isMobile}
        <Sidebar />
      {/if}
      <div
        class="main-content relative flex flex-col flex-grow overflow-hidden min-w-0 min-h-0 h-full"
        bind:this={mainContent}
      >
        <OmniBar />
        <AudioPlayer />
        <NoteList />
        <ResizeHandle
          orientation="vertical"
          bind:value={$noteListHeight}
          min={NOTE_LIST_MIN_PX}
          getMax={getNoteListMax}
          ariaLabel="Resize note list"
          onUserChange={onNoteListUserChange}
        />
        <NoteDetail />
        {#if $showStatusBar}
          <StatusBar />
        {/if}
      </div>
    </main>
  </div>

  {#if isDemo}
    <DemoMarketing />
  {/if}

  {#if isAppWindowed}
    {#each $notePopups as popup (popup.id)}
      <NotePopupWindow
        id={popup.id}
        guid={popup.guid}
        left={popup.left}
        top={popup.top}
        width={popup.width}
        height={popup.height}
        zIndex={popup.zIndex}
      />
    {/each}
  {/if}
</div>

<style>
  h1 {
    font-size: 69px;
    line-height: 0;
    font-weight: 600;
    font-family:Arial, Helvetica, sans-serif;
    margin-bottom: 50px;
  }
  p {
    max-width: 540px;
    font-size: 15px;
    line-height: 24px;
    padding: 0 20px;
    opacity: 0.6;
  }
  .demo-hero-visible {
    opacity: 1;
    height: 200px;
  }
  .demo-hero-hidden {
    opacity: 0;
    height: 0;
    overflow: hidden;
    pointer-events: none;
  }
  /* First viewport in Demo: fill the shell under p-2 so main.windowed 50% resolves. */
  .demo-stage {
    min-height: calc(100dvh - 1rem);
    height: calc(100dvh - 1rem);
    flex-shrink: 0;
  }
  /* Fullscreen size lives in CSS (not the style attr) so windowFrame reset
     can clear resize overrides without wiping the tween target. */
  main.fullscreen {
    max-width: 100%;
    width: 100%;
    height: 100%;
    border: 1px solid rgba(0,0,0,0.0);
    border-radius: 0;
    /* viewport-fit=cover + black-translucent: keep chrome clear of notch/home indicator. */
    padding-top: env(safe-area-inset-top, 0px);
    padding-right: env(safe-area-inset-right, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    padding-left: env(safe-area-inset-left, 0px);
  }
  main.windowed {
    max-width: 690px;
    width: 100%;
    height: 50%;
    min-height: 300px;
    flex-grow: 0;
    flex-shrink: 0;
    border-radius: 8px;
    border: 1px solid #3a3f412e;
    -webkit-box-shadow: 0px 36px 69px -24px rgba(0,0,0,0.75);
    box-shadow: 0px 36px 69px -24px rgba(0,0,0,0.75);
    touch-action: manipulation;
  }
  main.windowed.sidebar-open {
    max-width: calc(690px + var(--sidebar-width, 443px));
  }
  .main-content {
    z-index: 1;
    background-color: var(--app-background);
  }

  .sidebar-backdrop {
    position: fixed;
    inset: 0;
    z-index: 49;
    margin: 0;
    padding: 0;
    border: none;
    background: rgba(0, 0, 0, 0.42);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  /* Invisible corner hit targets — cursor-only chrome */
  :global(.window-corner) {
    position: absolute;
    width: 16px;
    height: 16px;
    z-index: 40;
    background: transparent;
    touch-action: none;
    pointer-events: auto;
  }
  :global(.window-corner-nw) {
    top: 0;
    left: 0;
    cursor: nwse-resize;
  }
  :global(.window-corner-ne) {
    top: 0;
    right: 0;
    cursor: nesw-resize;
  }
  :global(.window-corner-sw) {
    bottom: 0;
    left: 0;
    cursor: nesw-resize;
  }
  :global(.window-corner-se) {
    bottom: 0;
    right: 0;
    cursor: nwse-resize;
  }
</style>
