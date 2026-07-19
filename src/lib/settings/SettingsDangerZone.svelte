<script>
  import { resetDatabase, hardRefreshApp } from '$lib/store';

  let resetConfirming = $state(false);
  let resetting = $state(false);
  let resetError = $state('');

  let hardRefreshConfirming = $state(false);
  let hardRefreshing = $state(false);
  let hardRefreshError = $state('');

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

<div style="border: 1px solid #673132; border-radius: 8px; margin-top: 20px; padding: 15px; background: #242021;">
  <div class="font-bold">Dangerzone</div>

  {#if resetConfirming}
    <p class="text-gray-400" style="margin-top: 10px; font-size: 13px; line-height: 1.4;">
      Deletes all notes and restores the five seeded defaults. Preferences reset too.
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
