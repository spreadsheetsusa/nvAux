# nvAux

# Core Principles and Rules to follow

- We compile down to a single html file for deployment. binary is base64'd into the file. Be resourceful and clever.
- We do not use tailwind, but we think like tailwind. Optimize accordingly.
- When i mention a tailwind-like class and it doesn't existm add it to style.css and use that instead of on-offs.
- Aim for platform-agnostic code and architecture. We want to work in all common browsers and devices.

**nvAux** is a browser-based note-taking PWA (Svelte 5 + Vite 8). There is no backend — all data lives in IndexedDB via RxDB/Dexie.

### Services

| Service | Command | Port |
|---------|---------|------|
| Vite dev server | `bun dev` | 5173 (binds `0.0.0.0` via `--host`) |

### Key commands

- **Install deps:** `bun i` (lockfile: `bun.lock`)
- **Dev server:** `bun dev`
- **Build:** `bun run build` (produces a single-file `dist/index.html` via `vite-plugin-singlefile`)
- **Preview prod build:** `bun run preview`

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
- Keep list/detail and window chrome layout-stable: note body length must not shift chrome above the note list; when the window shrinks (esp. Windowed), clamp `noteListHeight` so NoteDetail keeps a minimum visible height and is never pushed past the fold; dragging the list/detail splitter past the min threshold should snap NoteList fully hidden while keeping a recover handle/dragger.
- Prefer minimal, cross-browser thin scrollbar styling on scrollable panes (sidebar, note list, note detail) instead of default OS scrollbars.
- Markdown preview may stay on while browsing normal notes (hide/off for empty and settings); prefer Obsidian-like editable preview with `[[wiki link]]` autocomplete, keeping raw Edit for true source text.
- Life Calendar life↔week view transitions should stay scoped to the sidebar (avoid full-window flashes) and feel smooth when moving between weeks; selecting a note (NoteList / Graph) should accent-outline that note's week in the life grid; prefer not highlighting the open note inside week-note lists (NoteList already shows selection).
- Media player session is user-controlled (Play Now / Play Next / Add Last); switching notes must not reset or auto-queue tracks; markdown `[label](url)` text drives playlist/player titles as `Note · Track` with a smooth overflow marquee; an active session should keep playing until closed.
- On mobile (`$isMobile`): sidebar drawer must respect the visual viewport and leave a dismiss peek so the backdrop stays tappable; NoteList vertical ellipsis stays visible while the relative-time column moves into that menu as a readonly muted label; hide AudioPlayer volume control.

## Learned Workspace Facts

- Default open is Demo Mode (site chrome with hero/tagline). Settings note toggles App Mode (`fullScreen`) and nested Windowed (`windowed`). Windowed is Settings-only. Omnibar toggles Demo ↔ App Fullscreen (from Windowed it enters App Fullscreen; minimize returns to Demo, not Windowed). Demo ↔ Fullscreen should keep the original smooth size tween and demo-chrome fade (avoid jarring placement jumps on minimize). In Demo Mode the page scrolls like a landing page with marketing sections under the app card (`src/lib/components/marketing/`); the Demo shell uses `h-screen overflow-y-auto` (not only `min-h-screen`) so content can scroll inside the `body` overflow clip. Demo stage top-aligns hero+app; `demo-window` is taller on desktop when space allows and stays compact on mobile; App/Windowed stay non-scrolling viewport chrome and are unaffected by demo-stage layout.
- Omnibar toggles a slidable sidebar; when Demo or App Windowed, opening the sidebar grows the main window width. Default expand width is 443px (`sidebarWidth`). On mobile, the drawer width tracks `visualViewport` (fallback `innerWidth`) and leaves a ~52px peek for backdrop dismiss.
- Windowed App Mode has no demo hero; the floating window uses fixed left/top positioning for Photoshop-style corner resize (opposite corner stays put) and threshold drag from Life Calendar / Omnibar regions (`windowFrame`). Main window geometry persists as `appWindowFrame` in localStorage and restores (clamped) when re-entering Windowed / on viewport resize. Entering Windowed from Fullscreen tweens down to the restored or default Demo-sized card. Move/resize are App Windowed only — not Demo. In App Windowed, note-list ellipsis or double-click opens session-only `notePopups` floating editors (`NotePopupWindow.svelte`, drag/resize); leaving Windowed closes all popups; main window and popups share focus z-order. Ellipsis Rename inline-edits the title (Enter/blur save, Escape cancel). Markdown notes can be sticky via toolbar + frontmatter (`sticky: true`, `color: yellow|pink|blue`); in Windowed they auto-surface as fixed-size colored post-its (`StickyNote.svelte`) that replace the normal popup until sticky is turned off; sticky positions persist in `stickyNoteFrames`; title hover shows three color swatches; X dismisses for the session only.
- Omnibar tray (upper-right): Settings cog opens the settings note; fullscreen control and clock sit beside it. Accent color is a Settings preference (color picker + five presets) applied via a shared CSS variable; it seeds a soft desaturated page gradient (`accentGradient.js` → `--grad-1..4`) that fades between accents (default cold gray-blue, not green). Demo hero exposes the five presets for quick picking. StatusBar footer shows the nvAux version string, gated by `showStatusBar` (default off).
- Sidebar width and note-list height are user-resizable and persisted via `sidebarWidth` / `noteListHeight` in `store.js` (localStorage). Dragging the list/detail splitter past the open min (~60px) snaps `noteListHeight` to `0` (list chrome hidden); the splitter remains as the reveal affordance and height `0` persists across reloads.
- Life Calendar (`LifeCalendar.svelte`) renders in the sidebar as week squares in year rows; Profile settings `birthDate` and `expectedLongevity` drive its span. Absent weeks stay dimmed. Title button click-cycles `lifeCalendarStat` (default Life Calendar); week-number gutter at sidebar width ≥712px. Week cells zoom into a sidebar-scoped week stream (sticky Year/Month/Week pins, Now control; double-click Now zooms out). Week notes open in NoteDetail and scroll into view in NoteList; selecting a note (NoteList / Graph) accent-outlines that note's week in the life grid and, while week view is open, scrolls the week stream to that note's `createdAt` week without overriding a fresh week zoom-in. Note toolbar calendar control can adjust a note's creation date for timeline placement.
- Note toolbar hosts media queue actions (Play Now primary accent on the left; Play Next / Add Last secondary), creation-date editor, sticky pin (markdown only), and Preview/Edit; plain markdown defaults to Edit and rich types (kanban) default to Preview; prefs persist per kind (`markdownPreviewPlain` / `markdownPreviewRich`) so toggles do not cross kinds (hidden/off for empty and settings only in the UI); preview uses `marked` with highlight.js for fenced code blocks; preview/edit content should share the same top spacing.
- Wiki-style `[[Note Title]]` links: editor autocomplete suggests matching note titles; markdown preview renders them as clickable in-app links that open by exact `name` (create-and-open if missing) via `openNoteByName` without changing Omnibar filter.
- Graph View is a tall, bottom-pinned sidebar footer (`NoteGraphView.svelte`) under Life Calendar: open from the calendar title-row graph icon, close via header X with `slide` transition; height-draggable (`graphViewHeight`) and zoom (`graphViewZoom`) persist in localStorage; vertical zoom slider on the right, zoom-to-fit beside close; node titles only at adequate zoom. SVG + `d3-force` layout from `[[wiki links]]` (ghost nodes, collide, connected-component clustering, drag-with-reheat); click a node to open the note without changing Omnibar filter. Prefer lean deps (avoid heavy graph viewers) for the single-file build.
- Note types are body-driven (YAML-ish frontmatter `type: …`), not a schema field: `resolveNoteType` routes Settings / kanban / markdown. Frontmatter may also carry sticky/color for markdown notes (no `type` required). Kanban Preview is the board UI; Edit is raw source. SoundCloud and image/video file URLs queue into a persistent `mediaSession` playlist; markdown `[label](url)` text is preferred for titles (else oEmbed/URL); `AudioPlayer.svelte` under the Omnibar slides in/out with `Note · Track` marquee (double-click opens the source note), editable playlist, and `mediaPlayerHeight`; visual tracks slide `MediaViewer` above the player bar.
- Default seeded notes are Welcome, nvAux Settings, `🎧 The Gentleman's Techno League - EP1` (SoundCloud demo), and `📋 Sample Kanban`; fresh DBs must get all four (`db()` shares one in-flight open so seeding is not raced away). Settings note `updatedAt` bumps when preferences change. Reset Database uses inline confirm and restores only those seeded notes; Settings also offers Hard Refresh (service-worker/cache bust) with inline confirm beside Reset.
- Amplify CI (`amplify.yml`) installs Bun in `preBuild` (not preinstalled), then runs `bun i --frozen-lockfile` and `bun run build`.
