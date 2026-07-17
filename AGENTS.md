# nvAux

**nvAux** is a browser-based note-taking PWA (Svelte 5 + Vite 8). There is no backend — all data lives in IndexedDB via RxDB/Dexie.

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

## Learned User Preferences

- Prefer simple, foundational upgrades that keep the app working; avoid broad rewrites when migrating packages or Svelte APIs.
- When upgrading Svelte, migrate toward runes mode (`$derived` / `$props` / etc.) rather than leaving legacy `$:` syntax in place.
- Prefer Bun as the package manager (`bun install`, `bun.lock`, `bun run`) when switching tooling off npm.
- Drag/resize handles should share the same smooth, stable 1:1 tracking and active styling across the sidebar and the note list/detail splitter.
- Selecting a note must not overwrite Omnibar `omniText` or filter mode; keep the user's current filtering/search position while they click notes.
- Note body length must not shift layout chrome above the note list (list/detail split and window chrome stay stable).
- Prefer minimal, cross-browser thin scrollbar styling on scrollable panes (sidebar, note list, note detail) instead of default OS scrollbars.
- Markdown preview may stay on while browsing between normal notes; hide or turn it off for empty and settings notes.

## Learned Workspace Facts

- Omnibar toggles a slidable sidebar; when not in fullscreen mode, opening the sidebar grows the main window width. Default expand width is 443px (`sidebarWidth`).
- Fullscreen control and clock live in the Omnibar tray (upper-right); the nvAux version string stays in the StatusBar footer.
- Sidebar width and note-list height are user-resizable and persisted via `sidebarWidth` / `noteListHeight` in `store.js` (localStorage).
- Life Calendar (`LifeCalendar.svelte`) renders in the sidebar as week squares in year rows; Profile settings `birthDate` and `expectedLongevity` in `store.js` drive its span (not hard-coded constants). Absent weeks stay in the grid but render dimmed. Title is "LIVE CALENDAR" with click-cycled stats persisted as `lifeCalendarStat` (% lived, years lived, % remaining, years remaining). Week-number gutter shows only when sidebar width is at least 712px.
- StatusBar Preview toggles `markdownPreview` for normal notes (not empty/settings); preview uses `marked` with highlight.js syntax coloring for fenced code blocks.
- Default seeded notes are the Welcome note and the nvAux settings note; both should appear for a fresh database.
