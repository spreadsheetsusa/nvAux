<script>
  import JSZip from 'jszip';
  import saveAs from 'file-saver';

  import { db } from './store';

  let db$;

  const handleDownloadZip = async () => {
    let zip = new JSZip();
    db$ = await db();
    const notes = await db$.notes.find().exec();
    notes.map((n) => zip.file(`${n.name}.txt`, `${n.body}`));
    zip.generateAsync({type:"blob"})
    .then((data) => saveAs(data, "nakedNV-notes.zip"));
  };
</script>

<button aria-label="Download Notes" onclick={handleDownloadZip} class="btn bg-gray-800" style="font-size: 14px;">
    Download Notes
</button>
