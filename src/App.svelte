<script>
  import { onMount } from 'svelte';

  import OmniBar from './lib/OmniBar.svelte';
  import NoteList from './lib/NoteList.svelte';
  import ResizeHandle from './lib/ResizeHandle.svelte';
  import NoteDetail from './lib/NoteDetail.svelte';
  import StatusBar from './lib/StatusBar.svelte';
  import AudioPlayer from './lib/AudioPlayer.svelte';
  import Sidebar from './lib/Sidebar.svelte';
  import NotePopupWindow from './lib/NotePopupWindow.svelte';

  import {
    fullScreen,
    windowed,
    sidebarOpen,
    sidebarWidth,
    noteListHeight,
    mediaPlayerHeight,
    notePopups,
    closeAllNotePopups,
    showStatusBar,
  } from './lib/store';
  import { windowFrame } from './utils/windowFrame';

  /** Chrome below/above the note list excluding the status bar (OmniBar, handle, margins). */
  const LIST_CHROME_BASE_PX = 65;
  /** Status bar height used when reserving space for NoteDetail clamping. */
  const STATUS_BAR_CHROME_PX = 35;
  /** Minimum NoteDetail viewport so body content is never pushed past the fold. */
  const NOTE_DETAIL_MIN_PX = 120;
  const NOTE_LIST_MIN_PX = 60;

  let mainContent = $state(null);

  let isDemo = $derived(!$fullScreen);
  let isAppWindowed = $derived($fullScreen && $windowed);
  let isAppFullscreen = $derived($fullScreen && !$windowed);
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

  function clampNoteListHeight() {
    const max = getNoteListMax();
    noteListHeight.update((h) => (h > max ? max : h));
  }

  // Keep NoteDetail on-screen when the app window (or media chrome) shrinks.
  $effect(() => {
    const el = mainContent;
    // Re-run when media player / status bar chrome changes reserved space.
    void $mediaPlayerHeight;
    void listChromePx;
    if (!el) return;

    clampNoteListHeight();
    const ro = new ResizeObserver(() => clampNoteListHeight());
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

<div class="h-screen w-screen overflow-hidden flex flex-col justify-center items-center transition-all {isAppFullscreen ? '' : 'p-2'}">

    <div
      class="demo-hero transition-all text-center"
      class:demo-hero-visible={isDemo}
      class:demo-hero-hidden={!isDemo}
    >
      <div style="perspective: {isDemo ? '150' : '0'}px;" class="transition-all">
        <h1 style="opacity: 0.9; text-shadow: 1px 3px 5px rgba(0,0,0,0.5); transform: rotateX(6deg) rotateY(0deg); transform-style: preserve-3d;">nvAux</h1>
      </div>
      <p>Capture and retrieve ideas at the speed of thought with nvAux, the in-the-zone note-taking app for creative professionals.</p>
    </div>

  <main
    use:windowFrame={{ enabled: isAppWindowed, threshold: 2 }}
    class="{isAppFullscreen ? 'fullscreen' : 'windowed'} relative overflow-hidden flex transition-all"
    class:sidebar-open={$sidebarOpen}
    style="background-color: var(--app-background); --sidebar-width: {$sidebarWidth}px;"
  >
    <Sidebar />
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
      />
      <NoteDetail />
      {#if $showStatusBar}
        <StatusBar />
      {/if}
    </div>
  </main>

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
  /* Fullscreen size lives in CSS (not the style attr) so windowFrame reset
     can clear resize overrides without wiping the tween target. */
  main.fullscreen {
    max-width: 100%;
    width: 100%;
    height: 100%;
    border: 1px solid rgba(0,0,0,0.0);
    border-radius: 0;
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
