<script>
  import { verifyLockPin, unlockNoteSession, touchNoteActivity } from './store';

  /** @type {{ guid: string, onUnlocked?: () => void, variant?: 'default' | 'sticky' }} */
  let { guid, onUnlocked = undefined, variant = 'default' } = $props();

  let pin = $state('');
  let error = $state('');

  function submit() {
    error = '';
    if (!verifyLockPin(pin)) {
      error = 'Incorrect PIN';
      return;
    }
    unlockNoteSession(guid);
    touchNoteActivity(guid);
    pin = '';
    onUnlocked?.();
  }

  function handleKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  }

  function onPinInput(event) {
    pin = String(event.currentTarget.value || '')
      .replace(/\D/g, '')
      .slice(0, 6);
    error = '';
  }
</script>

<div
  class="unlock-panel flex flex-col items-center justify-center flex-1 min-h-0"
  class:unlock-sticky={variant === 'sticky'}
>
  <p class="unlock-title">Note locked</p>
  <p class="unlock-hint">Enter your 6-digit Lock PIN to view</p>
  <div class="unlock-row flex items-center">
    <input
      class="unlock-input"
      type="password"
      inputmode="numeric"
      autocomplete="one-time-code"
      maxlength="6"
      placeholder="••••••"
      aria-label="Lock PIN"
      value={pin}
      oninput={onPinInput}
      onkeydown={handleKeydown}
    />
    <button type="button" class="btn unlock-btn" onclick={submit} disabled={pin.length !== 6}>
      Unlock
    </button>
  </div>
  {#if error}
    <p class="unlock-error">{error}</p>
  {/if}
</div>

<style>
  .unlock-panel {
    gap: 8px;
    padding: 24px 16px;
  }

  .unlock-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
  }

  .unlock-hint {
    margin: 0;
    font-size: 13px;
    color: #9ca3af;
  }

  .unlock-sticky .unlock-title {
    color: #111827;
    font-size: 14px;
  }

  .unlock-sticky .unlock-hint {
    color: #4b5563;
    font-size: 12px;
  }

  .unlock-sticky .unlock-input {
    background: color-mix(in srgb, #fff 70%, transparent);
    border-color: color-mix(in srgb, #000 18%, transparent);
    color: #111827;
  }

  .unlock-sticky .unlock-btn {
    font-size: 12px;
  }

  .unlock-row {
    gap: 8px;
    margin-top: 8px;
  }

  .unlock-input {
    box-sizing: border-box;
    width: 7.5em;
    height: 32px;
    padding: 0 10px;
    border: 1px solid #404040;
    border-radius: 6px;
    background: #1a1c1e;
    color: #e5e7eb;
    font-size: 16px;
    letter-spacing: 0.2em;
    text-align: center;
    outline: none;
  }

  .unlock-input:focus {
    border-color: #525962;
  }

  .unlock-btn {
    height: 32px;
    padding: 0 12px;
    background: var(--app-accent);
  }

  .unlock-btn:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .unlock-error {
    margin: 4px 0 0;
    font-size: 13px;
    color: #f87171;
  }
</style>
