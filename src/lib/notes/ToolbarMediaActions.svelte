<script>
  import './toolbarShared.css';

  /** @type {{ onQueue: (mode: 'now' | 'next' | 'last') => void }} */
  let { onQueue } = $props();
</script>

<div class="media-actions flex items-center flex-shrink-0">
  <button type="button" class="toolbar-btn accent" onclick={() => onQueue('now')}>
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      class="flex-shrink-0"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
    Play Now
  </button>
  <button type="button" class="toolbar-btn primary" onclick={() => onQueue('next')}>
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      class="flex-shrink-0"
    >
      <path d="M4 6h10v2H4V6zm0 5h8v2H4v-2zm0 5h6v2H4v-2z" />
      <path d="M16 11v4.5l4-2.25L16 11z" />
    </svg>
    Play Next
  </button>
  <button type="button" class="toolbar-btn primary" onclick={() => onQueue('last')}>
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      class="flex-shrink-0"
    >
      <path d="M4 6h10v2H4V6zm0 5h10v2H4v-2zm0 5h6v2H4v-2z" />
      <path d="M18 14v2h-2v2h2v2h2v-2h2v-2h-2v-2h-2z" />
    </svg>
    Add Last
  </button>
</div>

<style>
  .media-actions {
    gap: 4px;
    margin-right: 0;
  }
</style>
