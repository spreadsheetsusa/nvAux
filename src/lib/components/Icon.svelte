<script>
  import CalendarTime from './icons/CalendarTime.svelte';
  import ChevronLeft from './icons/ChevronLeft.svelte';
  import Edit from './icons/Edit.svelte';
  import Graph from './icons/Graph.svelte';
  import Lock from './icons/Lock.svelte';
  import Search from './icons/Search.svelte';
  import Settings from './icons/Settings.svelte';
  import Sidebar from './icons/Sidebar.svelte';
  import Sticky from './icons/Sticky.svelte';
  import Xcircle from './icons/Xcircle.svelte';
  import ZoomFit from './icons/ZoomFit.svelte';

  let { name, ...rest } = $props();

  const icons = {
    CalendarTime,
    ChevronLeft,
    Edit,
    Graph,
    Lock,
    Search,
    Settings,
    Sidebar,
    Sticky,
    Xcircle,
    ZoomFit,
  };

  const Cmp = $derived(icons[name]);
</script>

{#if Cmp}
  <Cmp {...rest} />
{/if}
