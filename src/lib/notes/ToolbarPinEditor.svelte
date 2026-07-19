<script>
  import { slide } from 'svelte/transition';
  import Icon from '$lib/components/Icon.svelte';
  import './toolbarShared.css';

  const pinSlide = { axis: 'x', duration: 180 };

  /** @type {{
   *   editing: boolean,
   *   pinDraft: string,
   *   pinError: string,
   *   pinActionLabel: string,
   *   pinMode: null | 'lock' | 'relock' | 'unlock' | 'remove',
   *   lockedOn: boolean,
   *   sessionUnlocked: boolean,
   *   onPinInput: (event: Event) => void,
   *   onCancel: () => void,
   *   onSubmit: () => void,
   *   onRemoveLock: () => void,
   *   onLockClick: () => void,
   * }} */
  let {
    editing,
    pinDraft,
    pinError,
    pinActionLabel,
    pinMode,
    lockedOn,
    sessionUnlocked,
    onPinInput,
    onCancel,
    onSubmit,
    onRemoveLock,
    onLockClick,
  } = $props();
</script>

{#if editing}
  <div class="pin-editor flex items-center flex-shrink-0" transition:slide={pinSlide}>
    <input
      class="pin-input"
      type="password"
      inputmode="numeric"
      autocomplete="one-time-code"
      maxlength="6"
      placeholder="PIN"
      aria-label="Lock PIN"
      value={pinDraft}
      oninput={onPinInput}
    />
    <button type="button" class="toolbar-btn" onclick={onCancel}>Cancel</button>
    {#if lockedOn && sessionUnlocked && (pinMode === 'relock' || pinMode === 'remove')}
      <button type="button" class="toolbar-btn" onclick={onRemoveLock}>Remove lock</button>
    {/if}
    <button
      type="button"
      class="toolbar-btn accent"
      onclick={onSubmit}
      disabled={pinDraft.length !== 6}
    >
      {pinActionLabel}
    </button>
    {#if pinError}
      <span class="pin-error">{pinError}</span>
    {/if}
  </div>
{:else}
  <button
    type="button"
    class="toolbar-btn flex-shrink-0 icon-btn"
    class:active={lockedOn}
    aria-label={lockedOn
      ? sessionUnlocked
        ? 'Lock note again'
        : 'Unlock note'
      : 'Lock note'}
    title={lockedOn
      ? sessionUnlocked
        ? 'Lock again (PIN)'
        : 'Unlock with PIN'
      : 'Lock note with PIN'}
    onclick={onLockClick}
  >
    <Icon name="Lock" class="lock-icon" />
  </button>
{/if}

<style>
  .pin-editor {
    gap: 4px;
  }

  .pin-input {
    box-sizing: border-box;
    height: 22px;
    padding: 0 6px;
    border: 1px solid #404040;
    border-radius: 3px;
    background: #1a1c1e;
    color: #e5e7eb;
    font-size: 12px;
    line-height: 1.2;
    color-scheme: dark;
    outline: none;
    width: 4.5em;
    letter-spacing: 0.15em;
    text-align: center;
  }

  .pin-input:focus {
    border-color: #525962;
  }

  .pin-error {
    font-size: 11px;
    color: #f87171;
    white-space: nowrap;
  }
</style>
