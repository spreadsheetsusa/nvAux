<script>
  // @ts-nocheck
  import { parseKanbanNote, serializeKanbanNote } from './kanbanModel';
  import KanbanThemeMenu from './KanbanThemeMenu.svelte';

  let {
    body = '',
    onChange,
  } = $props();

  let parsed = $derived(parseKanbanNote(body ?? ''));

  function onThemeChange(nextTheme) {
    if (!parsed.board) return;
    onChange?.(serializeKanbanNote(nextTheme, parsed.board));
  }
</script>

<KanbanThemeMenu theme={parsed.theme} onChange={onThemeChange} />
