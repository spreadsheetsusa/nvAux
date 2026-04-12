# AGENTS.md

## Cursor Cloud specific instructions

**nvAux** is a browser-based note-taking PWA (Svelte 4 + Vite 4). There is no backend — all data lives in IndexedDB via RxDB/Dexie.

### Services

| Service | Command | Port |
|---------|---------|------|
| Vite dev server | `npm run dev` | 5173 (binds `0.0.0.0` via `--host`) |

### Key commands

- **Install deps:** `npm install` (lockfile: `package-lock.json`)
- **Dev server:** `npm run dev`
- **Build:** `npm run build` (produces a single-file `dist/index.html` via `vite-plugin-singlefile`)
- **Preview prod build:** `npm run preview`

### Notes

- No lint or test scripts are configured in `package.json`. Prettier config (`.prettierrc`) exists for formatting.
- Build emits a single CSS selector warning in `NoteList.svelte` (unused `.context-menu-wrapper`) — this is pre-existing and benign.
- No environment variables or external services are needed; everything runs client-side.
