# nvAux

# Core Principles and Rules to follow

- We compile down to a single html file for deployment. binary is base64'd into the file. Be resourceful and clever.
- We do not use tailwind, but we think like tailwind. Optimize accordingly.
- When i mention a tailwind-like class and it doesn't existm add it to style.css and use that instead of on-offs.

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
- Prefer Bun as the package manager (`bun install`, `bun.lock`, `bun run`) when switching tooling off npm; Amplify builds should install Bun then use `bun` (see `amplify.yml`).
- Prefer Tailwind-inspired utility `class=""` compositions in Svelte markup; keep component `<style>` blocks only for multi-use/DRY rules, and put shared cross-component styles in `style.css` (not a Tailwind install).
- Drag/resize (sidebar splitter, note list/detail splitter, Windowed main window, and note popups) should feel smooth, stable, and 1:1 with shared active styling; focused Windowed windows/popups raise to front (macOS-like z-order).
- Selecting a note or inline-renaming from the list ellipsis must not overwrite Omnibar `omniText` or filter mode; keep the user's current filtering/search position.
- Keep list/detail and window chrome layout-stable: note body length must not shift chrome above the note list; when the window shrinks (esp. Windowed), clamp `noteListHeight` so NoteDetail keeps a minimum visible height and is never pushed past the fold.
- Prefer minimal, cross-browser thin scrollbar styling on scrollable panes (sidebar, note list, note detail) instead of default OS scrollbars.
- Markdown preview may stay on while browsing between normal notes; hide or turn it off for empty and settings notes.
- Life Calendar life↔week view transitions should stay scoped to the sidebar (avoid full-window flashes) and feel smooth when moving between weeks; prefer not highlighting the open note inside week-note lists (NoteList already shows selection).
- In Demo Mode, allow normal page scroll with marketing landing sections under the note app; App/Windowed stay viewport-locked.
- Media player session is user-controlled (Add Next / Add Last / Play Now); switching notes must not reset or auto-queue tracks; markdown `[label](url)` text drives playlist/player titles as `Note · Track` with a smooth overflow marquee; an active session should keep playing until closed.
- On mobile, the sidebar drawer must respect the visual viewport and leave a dismiss peek so the backdrop stays tappable; NoteList's vertical ellipsis menu should always remain visible.

## Learned Workspace Facts

- Default open is Demo Mode (site chrome with hero/tagline). Settings note toggles App Mode (`fullScreen`) and nested Windowed (`windowed`). Windowed is Settings-only. Omnibar toggles Demo ↔ App Fullscreen (from Windowed it enters App Fullscreen; minimize returns to Demo, not Windowed). Demo ↔ Fullscreen should keep the original smooth size tween and demo-chrome fade (avoid jarring placement jumps on minimize). In Demo Mode the page scrolls like a landing page with marketing sections under the app card; App/Windowed stay non-scrolling viewport chrome.
- Omnibar toggles a slidable sidebar; when Demo or App Windowed, opening the sidebar grows the main window width. Default expand width is 443px (`sidebarWidth`). On mobile, the drawer width tracks `visualViewport` (fallback `innerWidth`) and leaves a ~52px peek for backdrop dismiss.
- Windowed App Mode has no demo hero; the floating window uses fixed left/top positioning for Photoshop-style corner resize (opposite corner stays put) and threshold drag from Life Calendar / Omnibar regions (`windowFrame`). Entering Windowed from Fullscreen tweens down to the default Demo-sized card first. Move/resize are App Windowed only — not Demo. In App Windowed, note-list ellipsis offers Open in new window → session-only `notePopups` floating editors (`NotePopupWindow.svelte`, drag/resize); leaving Windowed closes all popups; main window and popups share focus z-order. Ellipsis Rename inline-edits the title (Enter/blur save, Escape cancel).
- Fullscreen control and clock live in the Omnibar tray (upper-right); the nvAux version string stays in the StatusBar footer, gated by Settings General Preferences `showStatusBar` (default on).
- Sidebar width and note-list height are user-resizable and persisted via `sidebarWidth` / `noteListHeight` in `store.js` (localStorage).
- Life Calendar (`LifeCalendar.svelte`) renders in the sidebar as week squares in year rows; Profile settings `birthDate` and `expectedLongevity` in `store.js` drive its span (not hard-coded constants). Absent weeks stay in the grid but render dimmed. Title button click-cycles `lifeCalendarStat` (Life Calendar, Years Old, % lived, years lived, % remaining, years remaining); default mode is Life Calendar. Week-number gutter shows only when sidebar width is at least 712px.
- Life Calendar week cells zoom into a sidebar-scoped week view: infinite lifetime week stream with sticky Year/Month/Week pins, year-row context bar, muted future weeks, and a Now control (click jumps to the current week; double-click zooms back out). Week notes open in NoteDetail and scroll into view in NoteList.
- Note toolbar (top of note pane / popups) hosts Preview/Edit and SoundCloud queue actions; `markdownPreview` applies to normal notes (not empty/settings); preview uses `marked` with highlight.js for fenced code blocks.
- Wiki-style `[[Note Title]]` links: editor autocomplete suggests matching note titles; markdown preview renders them as clickable in-app links that open by exact `name` (create-and-open if missing) via `openNoteByName` without changing Omnibar filter.
- SoundCloud notes queue into a persistent `mediaSession` playlist; markdown `[label](url)` text is preferred for playlist/player titles (else oEmbed/URL); `AudioPlayer.svelte` under the Omnibar shows `Note · Track` with overflow marquee, source-note chip + editable playlist, and `mediaPlayerHeight`.
- Default seeded notes are the Welcome note and the nvAux settings note; both should appear for a fresh database (`db()` must share one in-flight open so prod seeding is not raced away).
- Amplify CI (`amplify.yml`) installs Bun in `preBuild` (not preinstalled), then runs `bun i --frozen-lockfile` and `bun run build`.
