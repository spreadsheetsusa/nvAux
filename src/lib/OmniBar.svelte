<script>
  import { onMount } from 'svelte';
  import { format } from 'date-fns';
  import { v4 as uuidv4 } from 'uuid';

  import IconXcircle from './IconXcircle.svelte';
  import IconSidebar from './IconSidebar.svelte';

  import { omniMode, omniText, selectedNote, db, bodyText, sidebarOpen, fullScreen, showClock } from './store';

  let omniInput = $state();
  let time = $state(new Date());

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
    await db$.notes.findOne({ selector: { name: $omniText } }).exec().then((note) => {
      omniMode.set('edit');
      if (note) {
        console.log('note found so lets edit it note: ', note);
        selectedNote.set(note);
        omniText.set(note.name);
        bodyText.set(note.body);
        return;
      } else {
        console.log('no note found so lets create one');
        db$.notes
          .insert({
            guid: uuidv4(),
            name: $omniText,
            createdAt: new Date().getTime(),
            updatedAt: new Date().getTime(),
          })
          .then((note) => {
            selectedNote.set(note);
            omniMode.set('edit');
            bodyText.set('');
          });
        return;
      }
    }).then(
      setTimeout(() => {
        document.getElementById('body-editor')?.focus();
      }, 50),
    );
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
    <IconSidebar />
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
        <IconXcircle />
      </button>
    {/if}
  </div>
  <div class="tray flex items-center flex-shrink-0" style="padding-right: 10px;">
    {#if $showClock}
      <div class="clock flex items-center" style="font-size: 12px; margin-right: 10px; color: #88959f;">{format(time, 'hh:mm:ss a')}</div>
    {/if}
    <button
      type="button"
      aria-label="Toggle fullscreen"
      class="bg-transparent flex items-center outline-none transition-all"
      style="color: {!$fullScreen ? 'var(--app-accent)' : '#818181'}"
      onclick={() => ($fullScreen = !$fullScreen)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-minimize">
        {#if $fullScreen}
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
