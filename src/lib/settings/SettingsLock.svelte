<script>
  import {
    lockPin,
    lockTimeoutSeconds,
    settingsLockFocus,
    LOCK_PIN_RE,
  } from '$lib/store';
  import './settingsForms.css';

  const LOCK_TIMEOUT_MAX = 3600;
  const LOCK_TIMEOUT_STEP = 15;

  /** @type {HTMLElement | null} */
  let lockSectionEl = $state(null);

  let pinDraft = $state('');
  let pinConfirmCurrent = $state('');
  let pinChanging = $state(false);
  let pinError = $state('');
  let pinHasSet = $derived(LOCK_PIN_RE.test($lockPin));

  let timeoutLabel = $derived.by(() => {
    const s = Number($lockTimeoutSeconds) || 0;
    if (s <= 0) return 'Never';
    if (s < 60) return `${s} seconds`;
    const m = s / 60;
    return m === 1 ? '1 min' : `${m} min`;
  });

  $effect(() => {
    if (!$settingsLockFocus || !lockSectionEl) return;
    requestAnimationFrame(() => {
      lockSectionEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  function dismissLockFocus() {
    if ($settingsLockFocus) settingsLockFocus.set(false);
  }

  function digitsOnly(value, max = 6) {
    return String(value || '')
      .replace(/\D/g, '')
      .slice(0, max);
  }

  function setPinFromDraft() {
    pinError = '';
    const next = digitsOnly(pinDraft);
    if (!LOCK_PIN_RE.test(next)) {
      pinError = 'PIN must be exactly 6 digits';
      return;
    }
    if (pinHasSet) {
      if ($lockPin !== digitsOnly(pinConfirmCurrent)) {
        pinError = 'Current PIN is incorrect';
        return;
      }
    }
    $lockPin = next;
    pinDraft = '';
    pinConfirmCurrent = '';
    pinChanging = false;
    dismissLockFocus();
  }

  function clearPin() {
    pinError = '';
    if (!pinHasSet) return;
    if ($lockPin !== digitsOnly(pinConfirmCurrent)) {
      pinError = 'Current PIN is incorrect';
      return;
    }
    $lockPin = '';
    pinDraft = '';
    pinConfirmCurrent = '';
    pinChanging = false;
    dismissLockFocus();
  }

  function onTimeoutInput(event) {
    dismissLockFocus();
    const n = Number(event.currentTarget.value);
    $lockTimeoutSeconds = Number.isFinite(n) ? n : 0;
  }
</script>

<div
  bind:this={lockSectionEl}
  id="settings-lock"
  style="border: 1px solid #2b2d30; border-radius: 8px; margin-top: 20px; padding: 15px;"
>
  <div class="font-bold" style="margin-bottom: 15px">Lock</div>

  {#if $settingsLockFocus}
    <p class="lock-setup-notice">
      Set a 6-digit Lock PIN here to lock notes. This notice closes when you use a Lock setting.
    </p>
  {/if}

  <div>
    <label for="lockPin">Lock PIN</label>
    <p class="text-gray-400" style="margin: 4px 0 0; font-size: 12px; line-height: 1.4;">
      {pinHasSet
        ? 'A Lock PIN is set. Enter the current PIN to change or clear it.'
        : 'Choose a 6-digit PIN. You will enter it whenever you lock or unlock a note.'}
    </p>

    {#if pinHasSet && !pinChanging}
      <div class="flex flex-wrap items-center" style="gap: 8px; margin-top: 10px;">
        <span class="text-gray-400" style="font-size: 13px;">••••••</span>
        <button
          type="button"
          class="btn"
          style="background: #3a3d42;"
          onclick={() => {
            pinChanging = true;
            pinError = '';
            dismissLockFocus();
          }}
        >
          Change PIN
        </button>
      </div>
    {:else}
      <div class="flex flex-col" style="gap: 8px; margin-top: 10px; max-width: 280px;">
        {#if pinHasSet}
          <input
            id="lockPinCurrent"
            class="settings-input"
            type="password"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="Current PIN"
            aria-label="Current Lock PIN"
            value={pinConfirmCurrent}
            onfocus={dismissLockFocus}
            oninput={(e) => {
              dismissLockFocus();
              pinConfirmCurrent = digitsOnly(e.currentTarget.value);
              pinError = '';
            }}
          />
        {/if}
        <input
          id="lockPin"
          class="settings-input"
          type="password"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          placeholder="New 6-digit PIN"
          aria-label="Lock PIN"
          value={pinDraft}
          onfocus={dismissLockFocus}
          oninput={(e) => {
            dismissLockFocus();
            pinDraft = digitsOnly(e.currentTarget.value);
            pinError = '';
          }}
        />
        <div class="flex flex-wrap items-center" style="gap: 8px;">
          <button
            type="button"
            class="btn"
            style="background: var(--app-accent);"
            onclick={setPinFromDraft}
          >
            {pinHasSet ? 'Update PIN' : 'Set PIN'}
          </button>
          {#if pinHasSet}
            <button
              type="button"
              class="btn"
              style="background: #3a3d42;"
              onclick={clearPin}
            >
              Clear PIN
            </button>
            <button
              type="button"
              class="btn"
              style="background: #3a3d42;"
              onclick={() => {
                pinChanging = false;
                pinDraft = '';
                pinConfirmCurrent = '';
                pinError = '';
              }}
            >
              Cancel
            </button>
          {/if}
        </div>
      </div>
    {/if}
    {#if pinError}
      <p style="color: #f87171; margin-top: 8px; font-size: 13px;">{pinError}</p>
    {/if}
  </div>

  <div style="margin-top: 18px;">
    <label for="lockTimeout">Lock timeout</label>
    <p class="text-gray-400" style="margin: 4px 0 0; font-size: 12px; line-height: 1.4;">
      Auto-relock after inactivity. 0 is never.
    </p>
    <div class="flex items-center" style="margin-top: 8px; gap: 12px;">
      <input
        id="lockTimeout"
        class="settings-range"
        type="range"
        min="0"
        max={LOCK_TIMEOUT_MAX}
        step={LOCK_TIMEOUT_STEP}
        value={$lockTimeoutSeconds}
        onfocus={dismissLockFocus}
        oninput={onTimeoutInput}
      />
      <span class="text-gray-400" style="font-size: 13px; min-width: 5.5em; white-space: nowrap;">
        {timeoutLabel}
      </span>
    </div>
  </div>
</div>
