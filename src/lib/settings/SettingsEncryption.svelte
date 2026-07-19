<script>
  import { regenerateEncryptionKey, getDbPasswordFingerprint } from '$lib/store';

  let regenConfirming = $state(false);
  let regenerating = $state(false);
  let regenError = $state('');
  let keyFingerprint = $state('');

  $effect(() => {
    let cancelled = false;
    getDbPasswordFingerprint().then((fp) => {
      if (!cancelled) keyFingerprint = fp;
    });
    return () => {
      cancelled = true;
    };
  });

  function cancelRegen() {
    if (regenerating) return;
    regenConfirming = false;
    regenError = '';
  }

  async function confirmRegen() {
    if (regenerating) return;
    regenerating = true;
    regenError = '';
    try {
      keyFingerprint = await regenerateEncryptionKey();
      regenConfirming = false;
    } catch (err) {
      regenError = err?.message || 'Key regeneration failed. Try again.';
    } finally {
      regenerating = false;
    }
  }

  $effect(() => {
    if (!regenerating) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  });
</script>

<div style="border: 1px solid #2b2d30; border-radius: 8px; margin-top: 20px; padding: 15px;">
  <div class="font-bold" style="margin-bottom: 10px">Encryption</div>
  <p class="text-gray-400" style="margin: 0; font-size: 13px; line-height: 1.45;">
    On — note titles and bodies are always encrypted at rest in IndexedDB. A device key is
    created automatically so the app opens without a password. This protects casual inspection
    of IndexedDB; anyone with full access to this browser profile can still read the key.
  </p>
  {#if keyFingerprint}
    <p class="text-gray-400" style="margin: 10px 0 0; font-size: 12px; line-height: 1.4;">
      Key fingerprint:
      <code style="color: #e5e7eb; font-size: 12px;">{keyFingerprint}</code>
    </p>
  {/if}

  {#if regenConfirming}
    <p class="text-gray-400" style="margin-top: 12px; font-size: 13px; line-height: 1.4;">
      Creates a new device key and re-encrypts all notes. Preferences and notes are kept.
    </p>
    <div class="flex flex-wrap items-center" style="gap: 8px; margin-top: 12px;">
      <button
        type="button"
        aria-label="Confirm Regenerate Encryption Key"
        class="btn"
        style="background: var(--app-accent);"
        disabled={regenerating}
        onclick={confirmRegen}
      >
        {regenerating ? 'Regenerating…' : 'Confirm Regenerate'}
      </button>
      <button
        type="button"
        aria-label="Cancel Regenerate Encryption Key"
        class="btn"
        style="background: #3a3d42;"
        disabled={regenerating}
        onclick={cancelRegen}
      >
        Cancel
      </button>
    </div>
    {#if regenError}
      <p style="color: #f87171; margin-top: 10px; font-size: 13px;">{regenError}</p>
    {/if}
  {:else}
    <div style="margin-top: 12px;">
      <button
        type="button"
        aria-label="Regenerate Encryption Key"
        class="btn"
        style="background: #3a3d42;"
        onclick={() => {
          regenConfirming = true;
          regenError = '';
        }}
      >
        Regenerate encryption key
      </button>
    </div>
  {/if}
</div>
