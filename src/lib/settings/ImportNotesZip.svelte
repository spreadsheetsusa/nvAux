<script>
  import JSZip from 'jszip';
  import { v4 as uuidv4 } from 'uuid';

  import { db, invalidateWikiNoteNames, syncStickyNotes } from '$lib/store';

  let files = $state();
  let status = $state('');
  let importing = $state(false);

  /** @param {Event & { currentTarget: HTMLInputElement }} e */
  const handleImport = async (e) => {
    const file = e.currentTarget.files?.[0];
    if (!file || importing) return;
    importing = true;
    status = 'Importing…';
    let imported = 0;
    let failed = 0;
    try {
      const database = await db();
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter(
        (entry) => !entry.dir && !entry.name.startsWith('__MACOSX')
      );
      const results = await Promise.all(
        entries.map(async (entry) => {
          try {
            const body = await entry.async('string');
            const date = entry.date?.getTime?.() || Date.now();
            const base = entry.name.split('/').pop() || 'Untitled';
            const name = base.replace(/\.[^/.]+$/, '') || 'Untitled';
            await database.notes.insert({
              guid: uuidv4(),
              name,
              body,
              createdAt: date,
              updatedAt: date,
            });
            return true;
          } catch (err) {
            console.error('Import note failed:', entry.name, err);
            return false;
          }
        })
      );
      for (const ok of results) {
        if (ok) imported += 1;
        else failed += 1;
      }
      if (imported > 0) {
        invalidateWikiNoteNames();
        void syncStickyNotes();
      }
      if (failed === 0) {
        status = imported === 0 ? 'No notes found in zip.' : `Imported ${imported} note${imported === 1 ? '' : 's'}.`;
      } else {
        status = `Imported ${imported}, failed ${failed}.`;
      }
    } catch (err) {
      console.error('Import zip failed:', err);
      status = 'Import failed. Check the zip file and try again.';
    } finally {
      importing = false;
      e.currentTarget.value = '';
    }
  };
</script>

<div class="flex flex-col gap-2">
  <label for="file-upload" class="btn bg-gray-800" class:opacity-50={importing}>
    {importing ? 'Importing…' : 'Import Notes'}
  </label>
  <input
    bind:files
    onchange={handleImport}
    id="file-upload"
    type="file"
    accept=".zip,application/zip"
    class="hidden"
    disabled={importing}
  />
  {#if status}
    <p class="text-sm text-gray-400 m-0">{status}</p>
  {/if}
</div>
