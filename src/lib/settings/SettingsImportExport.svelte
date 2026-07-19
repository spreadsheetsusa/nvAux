<script>
  import DownloadNotesZip from './DownloadNotesZip.svelte';
  import ImportNotesZip from './ImportNotesZip.svelte';
</script>

<div style="border: 1px solid #2b2d30; border-radius: 8px; margin-top: 20px; padding: 15px; ">
  <div class="font-bold">Import/Export Notes</div>
  <p class="text-gray-400">You can import (and export) a zip file full of .md and .txt files.</p>

  <ImportNotesZip />
  <DownloadNotesZip />
</div>
