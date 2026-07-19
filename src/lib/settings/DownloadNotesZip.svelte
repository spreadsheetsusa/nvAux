<script>
  import JSZip from 'jszip';
  import saveAs from 'file-saver';

  import { db } from '$lib/store';

  /** @param {string} name @param {Map<string, number>} used */
  function uniqueZipName(name, used) {
    const base = (name || 'Untitled').replace(/[\\/:*?"<>|]/g, '_');
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    return count === 0 ? `${base}.txt` : `${base} (${count}).txt`;
  }

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    const database = await db();
    const notes = await database.notes.find().exec();
    /** @type {Map<string, number>} */
    const used = new Map();
    for (const n of notes) {
      zip.file(uniqueZipName(n.name, used), n.body ?? '');
    }
    const data = await zip.generateAsync({ type: 'blob' });
    saveAs(data, 'nvaux-notes.zip');
  };
</script>

<button aria-label="Download Notes" onclick={handleDownloadZip} class="btn bg-gray-800" style="font-size: 14px;">
  Download Notes
</button>
