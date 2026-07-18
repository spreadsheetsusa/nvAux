<script>
  import { differenceInYears } from 'date-fns';
  import {
    db,
    windowed,
    showClock,
    showStatusBar,
    fullScreen,
    birthDate,
    expectedLongevity,
    isMobile,
    resetDatabase,
    hardRefreshApp,
    accentColor,
    ACCENT_COLOR_PRESETS,
  } from './store';

  import DownloadNotesZip from './DownloadNotesZip.svelte';
  import ImportNotesZip from './ImportNotesZip.svelte';
  import AbstractlyLogo from './AbstractlyLogo.svelte';

  const LONGEVITY_MAX = 120;

  let resetConfirming = $state(false);
  let resetting = $state(false);
  let resetError = $state('');

  let hardRefreshConfirming = $state(false);
  let hardRefreshing = $state(false);
  let hardRefreshError = $state('');

  /** @param {string} iso YYYY-MM-DD in local time (avoids UTC parse shift) */
  function parseLocalDate(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  /** Min expected longevity: current age + 1 (must include the current year of life). */
  let longevityMin = $derived.by(() => {
    const iso = $birthDate;
    if (!iso) return 1;
    const birth = parseLocalDate(iso);
    if (Number.isNaN(birth.getTime())) return 1;
    const age = differenceInYears(new Date(), birth);
    if (!Number.isFinite(age) || age < 0) return 1;
    return Math.min(LONGEVITY_MAX, age + 1);
  });

  // Keep stored longevity from falling below the birthdate-derived minimum.
  $effect(() => {
    const min = longevityMin;
    const current = parseInt($expectedLongevity, 10);
    if (!Number.isFinite(current) || current < min) {
      $expectedLongevity = String(min);
    }
  });

  function cancelReset() {
    if (resetting) return;
    resetConfirming = false;
    resetError = '';
  }

  async function confirmReset() {
    if (resetting) return;
    resetting = true;
    resetError = '';
    try {
      await resetDatabase();
      location.reload();
    } catch (err) {
      resetError = err?.message || 'Reset failed. Try again.';
      resetting = false;
    }
  }

  function cancelHardRefresh() {
    if (hardRefreshing) return;
    hardRefreshConfirming = false;
    hardRefreshError = '';
  }

  async function confirmHardRefresh() {
    if (hardRefreshing) return;
    hardRefreshing = true;
    hardRefreshError = '';
    try {
      await hardRefreshApp();
      location.reload();
    } catch (err) {
      hardRefreshError = err?.message || 'Hard refresh failed. Try again.';
      hardRefreshing = false;
    }
  }
</script>

<div class="text-white h-full" style="padding: 5px 15px; margin: 0;">
  <span class="font-bold">nvAux Settings</span>
  <div class="relative">
    {#await db().then((database) => database.notes.find().exec())}
      <p>...waiting</p>
    {:then notes}
      <p><span class="text-gray-400">Total Notes:</span> {notes.length}</p>
    {:catch error}
      <p style="color: red">{error.message}</p>
    {/await}

    <div style="border: 1px solid #2b2d30; border-radius: 8px; margin-top: 20px; padding: 15px;">
      <div class="font-bold" style="margin-bottom: 15px">General Preferences</div>

      <div>
        <label for="showClock"><input id="showClock" type="checkbox" bind:checked={$showClock} /> Show Clock</label>
      </div>
      <div style="margin-top: 15px;">
        <label for="showStatusBar"><input id="showStatusBar" type="checkbox" bind:checked={$showStatusBar} /> Show Status bar</label>
      </div>
      <div style="margin-top: 15px;">
        <label for="fullScreen"><input id="fullScreen" type="checkbox" bind:checked={$fullScreen} /> App Mode</label>
      </div>
      <div style="margin-top: 3px; margin-left: 15px; opacity: {$fullScreen && !$isMobile ? 1 : 0.5}">
        <label for="windowed">
          <input
            id="windowed"
            type="checkbox"
            disabled={!$fullScreen || $isMobile}
            bind:checked={$windowed}
          />
          Windowed{$isMobile ? ' (desktop only)' : ''}
        </label>
      </div>
      <div style="margin-top: 15px;">
        <label for="accentColor">Accent color</label>
        <div class="flex items-center accent-color-row" style="margin-top: 8px;">
          <input
            id="accentColor"
            class="settings-input settings-color"
            type="color"
            bind:value={$accentColor}
          />
          <div class="flex items-center accent-presets" role="group" aria-label="Accent color presets">
            {#each ACCENT_COLOR_PRESETS as preset (preset)}
              <button
                type="button"
                class="accent-preset"
                class:accent-preset-selected={$accentColor.toLowerCase() === preset}
                style:background={preset}
                aria-label="Set accent to {preset}"
                aria-pressed={$accentColor.toLowerCase() === preset}
                onclick={() => {
                  $accentColor = preset;
                }}
              ></button>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <div style="border: 1px solid #2b2d30; border-radius: 8px; margin-top: 20px; padding: 15px;">
      <div class="font-bold" style="margin-bottom: 15px">Profile</div>

      <div class="flex flex-wrap items-end" style="gap: 16px 24px;">
        <div class="flex flex-col" style="min-width: 160px;">
          <label for="birthDate">Birthdate</label>
          <div style="margin-top: 5px;">
            <input id="birthDate" class="settings-input" type="date" bind:value={$birthDate} />
          </div>
        </div>
        <div class="flex flex-col flex-1" style="min-width: 220px;">
          <label for="expectedLongevity">Expected Longevity</label>
          <div class="flex items-center" style="margin-top: 8px; gap: 12px;">
            <input
              id="expectedLongevity"
              class="settings-range"
              type="range"
              min={longevityMin}
              max={LONGEVITY_MAX}
              step="1"
              bind:value={$expectedLongevity}
            />
            <span class="text-gray-400" style="font-size: 13px; min-width: 4.5em; white-space: nowrap;">
              {$expectedLongevity} years
            </span>
          </div>
        </div>
      </div>
    </div>

    <div style="border: 1px solid #2b2d30; border-radius: 8px; margin-top: 20px; padding: 15px; ">
      <div class="font-bold">Import/Export Notes</div>
      <p class="text-gray-400">You can import (and export) a zip file full of .md and .txt files.</p>

      <ImportNotesZip />
      <DownloadNotesZip />
    </div>

    <div style="border: 1px solid #673132; border-radius: 8px; margin-top: 20px; padding: 15px; background: #242021;">
      <div class="font-bold">Dangerzone</div>

      {#if resetConfirming}
        <p class="text-gray-400" style="margin-top: 10px; font-size: 13px; line-height: 1.4;">
          Deletes all notes and restores the three seeded defaults. Preferences reset too.
        </p>
        <div class="flex flex-wrap items-center" style="gap: 8px; margin-top: 12px;">
          <button
            aria-label="Confirm Reset Database"
            class="btn"
            style="background: #b41111;"
            disabled={resetting}
            onclick={confirmReset}
          >
            {resetting ? 'Resetting…' : 'Confirm Reset'}
          </button>
          <button
            aria-label="Cancel Reset Database"
            class="btn"
            style="background: #3a3d42;"
            disabled={resetting}
            onclick={cancelReset}
          >
            Cancel
          </button>
        </div>
        {#if resetError}
          <p style="color: #f87171; margin-top: 10px; font-size: 13px;">{resetError}</p>
        {/if}
      {:else if hardRefreshConfirming}
        <p class="text-gray-400" style="margin-top: 10px; font-size: 13px; line-height: 1.4;">
          Unregisters the service worker, clears cached files, and reloads. Your notes are kept.
        </p>
        <div class="flex flex-wrap items-center" style="gap: 8px; margin-top: 12px;">
          <button
            aria-label="Confirm Hard Refresh"
            class="btn"
            style="background: #3a3d42;"
            disabled={hardRefreshing}
            onclick={confirmHardRefresh}
          >
            {hardRefreshing ? 'Refreshing…' : 'Confirm Hard Refresh'}
          </button>
          <button
            aria-label="Cancel Hard Refresh"
            class="btn"
            style="background: #3a3d42;"
            disabled={hardRefreshing}
            onclick={cancelHardRefresh}
          >
            Cancel
          </button>
        </div>
        {#if hardRefreshError}
          <p style="color: #f87171; margin-top: 10px; font-size: 13px;">{hardRefreshError}</p>
        {/if}
      {:else}
        <div class="flex flex-wrap items-center" style="gap: 8px; margin-top: 10px;">
          <button
            aria-label="Reset Database"
            class="btn"
            style="background: #b41111;"
            onclick={() => {
              resetConfirming = true;
              hardRefreshConfirming = false;
              resetError = '';
              hardRefreshError = '';
            }}
          >
            Reset Database
          </button>
          <button
            aria-label="Hard Refresh"
            class="btn"
            style="background: #3a3d42;"
            onclick={() => {
              hardRefreshConfirming = true;
              resetConfirming = false;
              hardRefreshError = '';
              resetError = '';
            }}
          >
            Hard Refresh
          </button>
        </div>
      {/if}
    </div>
  </div>

  <div class="text-center" style="padding-bottom: 300px;">
    <p class="items-center flex justify-center" style="margin-top: 100px; text-align: center; color: #5c6269; font-size: 11px; flex-wrap: wrap;">
      <span>Designed and Built by</span>
      <span class="relative" style="display: inline-block; height: 30px; width: 80px; top: 2px;"><a href="https://abstractly.io" target="_blank">
        <span class="flex items-center">
          <AbstractlyLogo />
        </span>
      </a></span> <span>The Human Interface Company.</span>
    </p>
    <p style="margin-top: 20px; color: #5c6269; font-size: 12px;">Hack on
      <a href="https://github.com/matterofabstract/nvaux" target="_blank" style="color: var(--app-accent); text-decoration: underline;">
        nvAux @ GitHub
      </a>
    </p>
  </div>
</div>

<style>
  .settings-input {
    background: #1a1c1e;
    color: #e5e7eb;
    border: 1px solid #2b2d30;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 13px;
    outline: none;
    color-scheme: dark;
  }

  .settings-input::placeholder {
    color: #6b7280;
  }

  .settings-input:focus {
    border-color: #404856;
  }

  .settings-input[type='date'] {
    color-scheme: dark;
  }

  .settings-input[type='date']::-webkit-calendar-picker-indicator {
    filter: invert(0.7);
    cursor: pointer;
  }

  .settings-color {
    width: 40px;
    height: 32px;
    padding: 2px 4px;
    cursor: pointer;
  }

  .accent-color-row {
    gap: 12px;
  }

  .accent-presets {
    gap: 8px;
  }

  .accent-preset {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid transparent;
    padding: 0;
    cursor: pointer;
    flex-shrink: 0;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  }

  .accent-preset:hover {
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
  }

  .accent-preset-selected {
    border-color: #e5e7eb;
    box-shadow: 0 0 0 1px #1a1c1e;
  }

  .accent-preset:focus-visible {
    outline: 2px solid #404856;
    outline-offset: 2px;
  }

  .settings-range {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    width: 100%;
    height: 6px;
    background: #2b2d30;
    border-radius: 3px;
    outline: none;
    accent-color: var(--app-accent);
    cursor: pointer;
  }

  .settings-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--app-accent);
    border: none;
    cursor: pointer;
  }

  .settings-range::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--app-accent);
    border: none;
    cursor: pointer;
  }

  .settings-range::-moz-range-track {
    height: 6px;
    background: #2b2d30;
    border-radius: 3px;
  }

  .settings-range:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 2px #1a1c1e, 0 0 0 4px #404856;
  }

  .settings-range:focus-visible::-moz-range-thumb {
    box-shadow: 0 0 0 2px #1a1c1e, 0 0 0 4px #404856;
  }
</style>
