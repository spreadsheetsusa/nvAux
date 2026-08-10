<script>
  import { onMount } from 'svelte';
  import { format } from 'date-fns';

  import Icon from '$lib/components/Icon.svelte';
  import OmniSlashSuggest from '$lib/omni/OmniSlashSuggest.svelte';
  import {
    autocompleteOmniSlashCommand,
    isOmniSlashInput,
    listOmniSlashCommands,
    parseOmniSlashCommand,
  } from '$lib/omni/slashCommands';
  import { defaultBodyForType } from '$lib/noteTypes/defaultNoteBody';

  import {
    omniMode,
    omniText,
    selectedNote,
    bodyText,
    sidebarOpen,
    fullScreen,
    windowed,
    showClock,
    isMobile,
    selectNoteByGuid,
    createOrOpenNote,
    SETTINGS_GUID,
  } from '$lib/store';

  let omniInput = $state();
  let time = $state(new Date());
  let isAppFullscreen = $derived($fullScreen && (!$windowed || $isMobile));

  /** Filter query for slash suggest; not updated by arrow/tab autocomplete. */
  let slashFilterQuery = $state('');
  let slashSelectedIndex = $state(0);
  let slashMenuOpen = $derived(isOmniSlashInput($omniText));
  let slashCandidates = $derived(
    slashMenuOpen ? listOmniSlashCommands(slashFilterQuery || $omniText) : []
  );
  let safeSlashIndex = $derived.by(() => {
    const len = slashCandidates.length;
    if (len === 0) return 0;
    return Math.min(slashSelectedIndex, len - 1);
  });

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

  /** @param {{ type: string, aliases: string[], label: string, description: string }} cmd */
  function applySlashAutocomplete(cmd) {
    const next = autocompleteOmniSlashCommand(cmd, $omniText);
    omniText.set(next);
    queueMicrotask(() => {
      if (!(omniInput instanceof HTMLInputElement)) return;
      omniInput.focus();
      const caret = next.length;
      omniInput.setSelectionRange(caret, caret);
    });
  }

  /** @param {Event} e */
  function handleOmniInput(e) {
    const value = e.currentTarget instanceof HTMLInputElement ? e.currentTarget.value : '';
    if (isOmniSlashInput(value)) {
      slashFilterQuery = value;
    } else {
      slashFilterQuery = '';
      slashSelectedIndex = 0;
    }
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
    if (e.key === 'Escape') {
      omniText.set('');
      bodyText.set('');
      slashFilterQuery = '';
      slashSelectedIndex = 0;
      omniInput.focus();
    }
  };

  /** @param {FocusEvent} e */
  const handleOmniFocus = (e) => {
    const input = e.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.dataset.focusCaretEnd === '1') {
      delete input.dataset.focusCaretEnd;
      return;
    }
    input.select();
  };

  const runSlashCreate = async () => {
    const parsed = parseOmniSlashCommand($omniText);
    if (!parsed || parsed.kind !== 'command') return false;

    omniMode.set('edit');
    const body = defaultBodyForType(parsed.type);
    const note = await createOrOpenNote({ name: parsed.title, body });
    if (!note) return true;

    omniText.set(note.name);
    slashFilterQuery = '';
    slashSelectedIndex = 0;
    setTimeout(() => {
      document.getElementById('body-editor')?.focus();
    }, 50);
    return true;
  };

  const addNote = async () => {
    if ($omniText === '') return;
    omniMode.set('edit');
    const note = await createOrOpenNote({ name: $omniText, body: '' });
    if (note) {
      omniText.set(note.name);
    }
    setTimeout(() => {
      document.getElementById('body-editor')?.focus();
    }, 50);
  };

  /** @param {KeyboardEvent} e */
  const handleOmniKeydown = (e) => {
    if (slashMenuOpen && slashCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = (safeSlashIndex + 1) % slashCandidates.length;
        slashSelectedIndex = next;
        applySlashAutocomplete(slashCandidates[next]);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next =
          (safeSlashIndex - 1 + slashCandidates.length) % slashCandidates.length;
        slashSelectedIndex = next;
        applySlashAutocomplete(slashCandidates[next]);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        applySlashAutocomplete(slashCandidates[safeSlashIndex] ?? slashCandidates[0]);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const parsed = parseOmniSlashCommand($omniText);
        if (parsed?.kind === 'command') {
          void runSlashCreate();
          return;
        }
        // Partial match: autocomplete selected, wait for another Enter to create.
        applySlashAutocomplete(slashCandidates[safeSlashIndex] ?? slashCandidates[0]);
        return;
      }
    }

    if (slashMenuOpen && e.key === 'Enter') {
      e.preventDefault();
      // Unknown slash with no candidates — no-op (do not create a "/foo" note).
      void runSlashCreate();
      return;
    }

    if (e.key === 'ArrowDown') {
      const first = document.querySelector('#noteList li[data-guid]');
      const guid = first?.getAttribute('data-guid');
      if (!guid) return;
      e.preventDefault();
      selectNoteByGuid(guid);
      document.getElementById('noteList')?.focus();
      return;
    }

    if (e.key === 'Enter') {
      if ($omniText === '') return;
      e.preventDefault();
      void addNote();
    }
  };
</script>

<svelte:window onkeydown={clearSelection} />

<div
  class="omnibar flex items-center border-box"
  style="background-color: var(--app-omni-background); height: 42px; padding-left: 4px; flex-shrink: 0;"
>
  <button
    type="button"
    aria-label="Toggle sidebar"
    aria-expanded={$sidebarOpen}
    class="bg-transparent flex items-center px-1 leading-none outline-none"
    onclick={() => ($sidebarOpen = !$sidebarOpen)}
  >
    <Icon name="Sidebar" />
  </button>
  <div class="input-wrapper relative flex-grow flex items-center">
    <input
      id="omni-input"
      bind:this={omniInput}
      bind:value={$omniText}
      onkeydown={handleOmniKeydown}
      oninput={handleOmniInput}
      onfocus={handleOmniFocus}
      type="text"
      class="flex-grow py-0.5 px-1 flex-grow"
      placeholder="Search, Create, or /kanban"
      autocomplete="off"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={slashMenuOpen && slashCandidates.length > 0}
      aria-controls="omni-slash-suggest"
    />
    {#if $omniText !== ''}
      <button
        type="button"
        aria-label="Clear Search"
        class="bg-transparent flex items-center px-2 leading-none outline-none"
        onclick={() => {
          $omniText = '';
          $selectedNote = '';
          slashFilterQuery = '';
          slashSelectedIndex = 0;
          document.getElementById('omni-input').focus();
        }}
      >
        <Icon name="Xcircle" />
      </button>
    {/if}
    <OmniSlashSuggest
      candidates={slashCandidates}
      selectedIndex={safeSlashIndex}
      visible={slashMenuOpen}
      onSelect={(cmd) => {
        const idx = slashCandidates.findIndex((c) => c.type === cmd.type);
        if (idx >= 0) slashSelectedIndex = idx;
        applySlashAutocomplete(cmd);
      }}
      onHover={(i) => {
        slashSelectedIndex = i;
      }}
    />
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
