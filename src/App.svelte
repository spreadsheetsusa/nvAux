<script>
  import { onMount } from 'svelte';

  import OmniBar from './lib/OmniBar.svelte';
  import NoteList from './lib/NoteList.svelte';
  import ResizeHandle from './lib/ResizeHandle.svelte';
  import NoteDetail from './lib/NoteDetail.svelte';
  import StatusBar from './lib/StatusBar.svelte';
  import Sidebar from './lib/Sidebar.svelte';

  import { fullScreen, maximumFullScreen, sidebarOpen, sidebarWidth, noteListHeight } from './lib/store';

  let mainContent;

  function getNoteListMax() {
    if (!mainContent) return 600;
    // Leave room for OmniBar, resize handle, NoteDetail, and StatusBar
    return Math.max(80, mainContent.clientHeight - 220);
  }

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

<div class="h-screen w-screen overflow-hidden flex flex-col justify-center items-center {$fullScreen ? '' : 'p-2'}">

    <div class="transition-all text-center" style="{$fullScreen ? 'opacity: 0; height: 0;' : 'height: 200px;' }">
      <div style="perspective: {$fullScreen ? '0' : '150'}px;" class="transition-all">
        <h1 style="opacity: 0.9; text-shadow: 1px 3px 5px rgba(0,0,0,0.5); transform: rotateX(6deg) rotateY(0deg); transform-style: preserve-3d;">nvAux</h1>
      </div>
      <p>Capture and retrieve ideas at the speed of thought with nvAux, the in-the-zone note-taking app for creative professionals.</p>
    </div>

  <main
    class="{$fullScreen ? 'fullscreen' : 'windowed'} relative overflow-hidden flex transition-all"
    class:sidebar-open={$sidebarOpen}
    style="{$fullScreen ? $maximumFullScreen ? 'height: 100%; width: 100%;' : 'height: calc(100dvh - 15px); width: calc(100vw - 15px); border-radius: 8px;' : ''} background-color: var(--app-background); --sidebar-width: {$sidebarWidth}px;"
  >
    <Sidebar />
    <div
      class="main-content relative flex flex-col flex-grow overflow-hidden"
      bind:this={mainContent}
    >
      <OmniBar />
      <NoteList />
      <ResizeHandle
        orientation="vertical"
        bind:value={$noteListHeight}
        min={60}
        getMax={getNoteListMax}
        ariaLabel="Resize note list"
      />
      <NoteDetail />
      <StatusBar />
    </div>
  </main>
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
  main.fullscreen {
    max-width: 100%;
    border: 1px solid rgba(0,0,0,0.0);
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
  }
  main.windowed.sidebar-open {
    max-width: calc(690px + var(--sidebar-width, 443px));
  }
  .main-content {
    position: relative;
    z-index: 1;
    min-width: 0;
    min-height: 0;
    height: 100%;
    overflow: hidden;
    background-color: var(--app-background);
  }
</style>
