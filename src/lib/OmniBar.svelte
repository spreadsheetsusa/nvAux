<script>
  import { onMount } from 'svelte';
  import { format } from 'date-fns';
  import { v4 as uuidv4 } from 'uuid';

  import Icon from '$lib/components/Icon.svelte';

  import {
    omniMode,
    omniText,
    selectedNote,
    db,
    bodyText,
    sidebarOpen,
    fullScreen,
    windowed,
    showClock,
    invalidateWikiNoteNames,
    isMobile,
    selectNoteByGuid,
    findNoteByNameExact,
  } from './store';

  const SETTINGS_GUID = '00000000-0000-0000-0000-000000000000';

  let omniInput = $state();
  let time = $state(new Date());
  let isAppFullscreen = $derived($fullScreen && (!$windowed || $isMobile));

  /** Omnibar: Demo ↔ App Fullscreen. Windowed is Settings-only. */
  function toggleAppFullscreen() {
    if (!$fullScreen || $windowed) {
      $fullScreen = true;
      $windowed = false;
    } else {
      $fullScreen = false;
    }
  }

  /** Open Settings note without changing Omnibar filter/search. */
  function openSettings() {
    selectNoteByGuid(SETTINGS_GUID);
  }

  onMount(() => {
    omniInput.focus();

    const interval = setInterval(() => {
      time = new Date();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  });

  const clearSelection = (e) => {
    if (e.keyCode === 27) {
      omniText.set('');
      bodyText.set('');
      omniInput.focus();
    }
  };

  const handleTitleEnter = (e) => {
    if ($omniText === '') return;
    e.keyCode === 13 && addNote();
  };

  const addNote = async () => {
    const db$ = await db();
    const note = await findNoteByNameExact($omniText);
    omniMode.set('edit');
    if (note) {
      selectedNote.set(note);
      omniText.set(note.name);
      bodyText.set(note.body);
    } else {
      const created = await db$.notes.insert({
        guid: uuidv4(),
        name: $omniText,
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
      });
      invalidateWikiNoteNames();
      selectedNote.set(created);
      omniMode.set('edit');
      bodyText.set('');
    }
    setTimeout(() => {
      document.getElementById('body-editor')?.focus();
    }, 50);
  };
</script>

<svelte:window onkeydown={clearSelection} />

<div
  class="omnibar flex items-center border-box"
  style="background-color: var(--app-omni-background); height: 42px; padding-left: 10px; flex-shrink: 0;"
>
  <button
    type="button"
    aria-label="Toggle sidebar"
    aria-expanded={$sidebarOpen}
    class="bg-transparent flex items-center px-2 leading-none outline-none"
    onclick={() => ($sidebarOpen = !$sidebarOpen)}
  >
    <Icon name="Sidebar" />
  </button>
  <div class="input-wrapper flex-grow flex items-center">
    <input
      id="omni-input"
      bind:this={omniInput}
      bind:value={$omniText}
      onkeydown={handleTitleEnter}
      onfocus={() => omniInput.select()}
      type="text"
      class="flex-grow py-0.5 px-1 flex-grow"
      placeholder="Search or Create"
    />
    {#if $omniText !== ''}
      <button
        type="button"
        aria-label="Clear Search"
        class="bg-transparent flex items-center px-2 leading-none outline-none"
        onclick={() => {
          $omniText = '';
          $selectedNote = '';
          document.getElementById('omni-input').focus();
        }}
      >
        <Icon name="Xcircle" />
      </button>
    {/if}
  </div>
  <div class="tray flex items-center flex-shrink-0" style="padding-right: 10px;">
    {#if $showClock}
      <div class="clock flex items-center select-none" style="font-size: 12px; margin-right: 10px; color: #88959f;">{format(time, 'hh:mm:ss a')}</div>
    {/if}
    <button
      type="button"
      aria-label="Open settings"
      class="bg-transparent flex items-center outline-none transition-all"
      style="margin-right: 8px;"
      onclick={openSettings}
    >
      <Icon name="Settings" />
    </button>
    <button
      type="button"
      aria-label="Toggle fullscreen"
      class="bg-transparent flex items-center outline-none transition-all"
      style="color: {!isAppFullscreen ? 'var(--app-accent)' : '#818181'}"
      onclick={toggleAppFullscreen}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minimize">
        {#if isAppFullscreen}
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
        {:else}
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        {/if}
      </svg>
    </button>
  </div>
</div>

<style>
  input {
    width: 100%;
    box-sizing: border-box;
    border-radius: 0px;
    font-size: 14px;
    background: transparent;
    color: white;
    height: 38px;
  }
  input:focus {
    outline: none;
  }
  input::placeholder {
    color: #88959f;
  }
  button[type="button"] {
    color: #404856;
  }
  button[type="button"]:hover {
    color: #ffffff7d;
  }
</style>
