# nvAux

# Core Principles and Rules to follow

- We compile down to a single html file for deployment. binary is base64'd into the file. Be resourceful and clever.
- We do not use tailwind, but we think like tailwind. Optimize accordingly.

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
- Prefer Tailwind-inspired utility `class=""` compositions in Svelte markup; keep component `<style>` blocks only for multi-use/DRY rules, and put shared cross-component styles in `style.css` (not a Tailwind install).
- Drag/resize handles should share the same smooth, stable 1:1 tracking and active styling across the sidebar and the note list/detail splitter.
- Selecting a note must not overwrite Omnibar `omniText` or filter mode; keep the user's current filtering/search position while they click notes.
- Note body length must not shift layout chrome above the note list (list/detail split and window chrome stay stable).
- When the app window shrinks (esp. Windowed mode), clamp `noteListHeight` so NoteDetail keeps a minimum visible height and is never pushed past the fold.
- Prefer minimal, cross-browser thin scrollbar styling on scrollable panes (sidebar, note list, note detail) instead of default OS scrollbars.
- Markdown preview may stay on while browsing between normal notes; hide or turn it off for empty and settings notes.
- Life Calendar life↔week view transitions should stay scoped to the sidebar (avoid full-window flashes) and feel smooth when moving between weeks.
- Prefer not highlighting the open note inside Life Calendar week-note lists; NoteList already shows selection.
- Media player playlist updates from note body edits should be debounced/additive so playback is not disrupted by remounts.

## Learned Workspace Facts

- Default open is Demo Mode (site chrome with hero/tagline). Settings note toggles App Mode (`fullScreen`) and nested Windowed (`windowed`). Windowed is Settings-only. Omnibar toggles Demo ↔ App Fullscreen (from Windowed it enters App Fullscreen; minimize returns to Demo, not Windowed).
- Omnibar toggles a slidable sidebar; when Demo or App Windowed, opening the sidebar grows the main window width. Default expand width is 443px (`sidebarWidth`).
- Windowed App Mode has no demo hero; the floating window uses fixed left/top positioning for Photoshop-style corner resize (opposite corner stays put) and threshold drag from Life Calendar / Omnibar regions (`windowFrame`). Entering Windowed from Fullscreen tweens down to the default Demo-sized card first. Move/resize are App Windowed only — not Demo.
- Fullscreen control and clock live in the Omnibar tray (upper-right); the nvAux version string stays in the StatusBar footer.
- Sidebar width and note-list height are user-resizable and persisted via `sidebarWidth` / `noteListHeight` in `store.js` (localStorage).
- Life Calendar (`LifeCalendar.svelte`) renders in the sidebar as week squares in year rows; Profile settings `birthDate` and `expectedLongevity` in `store.js` drive its span (not hard-coded constants). Absent weeks stay in the grid but render dimmed. Title button click-cycles `lifeCalendarStat` (Life Calendar, Years Old, % lived, years lived, % remaining, years remaining); default mode is Life Calendar. Week-number gutter shows only when sidebar width is at least 712px.
- Life Calendar week cells zoom into a sidebar-scoped week view: infinite lifetime week stream with sticky Year/Month/Week pins, year-row context bar, muted future weeks, and a Now control (click jumps to the current week; double-click zooms back out). Week notes open in NoteDetail and scroll into view in NoteList.
- StatusBar Preview toggles `markdownPreview` for normal notes (not empty/settings); preview uses `marked` with highlight.js syntax coloring for fenced code blocks.
- Notes with SoundCloud URLs show `AudioPlayer.svelte` above the StatusBar via the SoundCloud Widget API and oEmbed (no API auth); height is tracked with `mediaPlayerHeight` in `store.js`.
- Default seeded notes are the Welcome note and the nvAux settings note; both should appear for a fresh database.
