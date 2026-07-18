<script>
  let { name, ...rest } = $props();

  const modules = import.meta.glob('./icons/*.svelte', { eager: true });

  const Cmp = $derived(modules[`./icons/${name}.svelte`]?.default);
</script>

{#if Cmp}
  <Cmp {...rest} />
{/if}
