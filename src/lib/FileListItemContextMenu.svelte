<script>
  let { note, x = 0, y = 0, ondelete, onclose } = $props();

  function handleDelete() {
    ondelete?.(note);
  }

  function handleClose() {
    onclose?.();
  }
</script>

<div
  class="context-menu"
  style="position: fixed; left: {x}px; top: {y}px;"
>
  <button onclick={handleDelete}>Delete</button>
  <button onclick={handleClose}>Close</button>
</div>

<style>
  .context-menu {
    background: var(--app-omni-background);
    border: 1px solid var(--app-statusbar-border);
    border-radius: 4px;
    padding: 5px;
    z-index: 1000;
  }

  button {
    display: block;
    width: 100%;
    padding: 5px 10px;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--text-color);
    cursor: pointer;
  }

  button:hover {
    background: var(--app-notelist-odd-background);
  }
</style>
