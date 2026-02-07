# Dikt — Current State

Snapshot of the app as of commit `a2e04bd` on `main` (2026-02-07).

---

## Two-Window Architecture

The app runs two separate Tauri windows:

| Window | Label | Size | Traits |
|--------|-------|------|--------|
| **Pill overlay** | `main` | 360x100 fixed | Transparent, undecorated, always-on-top, skip-taskbar |
| **Settings** | `settings` | 1100x720 | Decorated, resizable, hidden by default, centered |

Window detection at boot (`src/main.tsx`) reads `getCurrentWindow().label` and mounts `App` or `SettingsApp` accordingly.

---

## Pill Overlay (main window)

A tiny always-visible floating pill at the bottom of the screen. Fixed dimensions — never resized at runtime to avoid the WebView2 compositor bug.

### States

| State | Visual | Size |
|-------|--------|------|
| **idle** | 5 white dots | 48x20 |
| **recording** | iOS-style sine wave (SiriWave lib) | 90x28 |
| **transcribing / formatting / pasting** | Animated loading dots | 90x28 |
| **done** | Green checkmark | 90x28 |
| **error** | Red `!` + gear button | 90x28 |

### Interaction
- **Hover** shows a tooltip with the current hotkey and a gear button to open settings.
- **Drag** anywhere on the pill to reposition it.
- **Click-through** is enabled during idle (Win32 `WS_EX_TRANSPARENT` toggling via custom Rust code — tao's built-in method is bypassed).

### Key files
- `src/App.tsx` — hotkey registration, state machine, event listeners
- `src/components/Pill/Pill.tsx` — state-based rendering
- `src/components/Pill/SineWaves.tsx` — recording visualizer
- `src/components/Tooltip.tsx` — always-in-DOM, CSS opacity/transform transitions
- `src/style.css` — all pill styling, compositor-safe transitions only

---

## Settings Window

Three-panel dashboard layout built with SolidJS + Tailwind CSS v4. Dark theme with green (`#10B77F`) accent. Light theme also supported via toggle.

### Layout (`src/components/Settings/Layout.tsx`)

```
┌──────────────┬──────────────────────────────┬─────────────────┐
│              │                              │                 │
│   Sidebar    │       Main Content           │   Right Panel   │
│   208px      │       flex-1                 │   320px         │
│              │                              │                 │
│  - Settings  │   (active tab renders here)  │  (shown on      │
│  - History   │                              │   Settings tab  │
│  - Vocabulary│                              │   only)         │
│  - Modes     │                              │                 │
│              │                              │                 │
│  Theme toggle│                              │                 │
│  User card   │                              │                 │
└──────────────┴──────────────────────────────┴─────────────────┘
```

History tab uses `fullBleed` mode — no right panel, full-width content area.

### Tabs — build status

| Tab | Status | Notes |
|-----|--------|-------|
| **Settings** | **Done** | Provider cards, connection details, API key, behavior (hotkey, trigger mode, output action). Fully wired. |
| **History** | **Done** | Search, date grouping (Today/Yesterday/This Week/Older), pagination (50/page), metadata (duration, language, mode), copy/delete, clear-all. Follows `history-redesign` mockup. |
| **Vocabulary** | **Placeholder** | Shows "Vocabulary is coming soon." Backend + state management fully wired in `SettingsApp.tsx`. |
| **Modes** | **Placeholder** | Shows "Modes is coming soon." Backend + state management fully wired in `SettingsApp.tsx`. |

### Settings tab (`src/components/Settings/SettingsPage.tsx`)
- **Transcription Provider** — 3-card grid (Groq / OpenAI / Custom) with checkmark on active
- **Connection Details** — base URL, model dropdown (or text input for custom), API key with show/hide toggle and "Get key" link
- **Provider Actions** — Test Connection + Save Provider buttons, error/success message area
- **Behavior** — Global Hotkey input, Recording Trigger (Toggle/Hold segmented control), Output Action dropdown; auto-saves on change

### History tab (`src/components/Settings/HistoryPage.tsx`)
- **Header row** — stat badges (total entries, today's count, total audio duration), search input, clear-all button
- **Grouped list** — items grouped by date with section headers (TODAY, YESTERDAY, etc.)
- **Item display** — transcription text, expandable "Show original" for mode-formatted items, non-English text shown in italics with quotes
- **Metadata row** — language badge (e.g. FR, ES), duration, mode name or "Dictation", relative time with exact-time tooltip
- **Hover actions** — Copy and Delete buttons per item
- **Pagination** — 50 items per page, ellipsis-compressed page numbers, Prev/Next

### Right panel (`src/components/Settings/RightPanel.tsx`)
**Static mockup** — not wired to real data:
- 3 transcription mode cards (Clean Draft, Meeting Minutes, Developer Mode) — hardcoded
- Enhancement toggles (Auto-Punctuation, Vocabulary Boost) — non-functional
- Live Input mic visualizer — static bars

### Sidebar (`src/components/Settings/Sidebar.tsx`)
- Logo + version ("PRO v2.1")
- 4 nav items with Material Symbols icons
- Theme toggle (light/dark) — functional, persisted to localStorage
- Placeholder user card ("Alex Chen") — cosmetic, no auth system exists

### Key files
- `src/SettingsApp.tsx` — all state management, CRUD operations, Tauri invoke calls
- `src/components/Settings/` — Layout, Sidebar, SettingsPage, HistoryPage, RightPanel, Select, historyUtils
- `src/settings.css` — Tailwind v4 config + custom theme tokens

---

## Backend — what's wired

All backend commands are implemented in Rust and invoked from `SettingsApp.tsx`:

| Command | Used by | Status |
|---------|---------|--------|
| `get_settings` / `save_settings` | Settings tab | Working |
| `test_connection` | Settings tab | Working |
| `fetch_provider_models` | Modes (state management ready) | Working |
| `get_transcription_history` | History tab | Working |
| `delete_transcription_history_item` | History tab | Working |
| `clear_transcription_history` | History tab | Working |
| `save_vocabulary` | Vocabulary (state management ready) | Working |
| `hide_settings_window` | Settings tab save | Working |

Transcription results are enriched with `duration_secs`, `language`, `mode_name`, and `original_text` (pre-mode-formatting text) in the Rust transcription pipeline.

---

## Legacy Settings Panel (dead code)

The old settings UI at `src/components/SettingsPanel/` is a compact collapsible panel from the previous UI iteration. All four tabs were fully implemented:

- `SettingsTab.tsx` — provider + API key form
- `VocabularyTab.tsx` + `VocabularyEditor.tsx` + `VocabularyEntry.tsx` — vocabulary CRUD
- `HistoryTab.tsx` — transcription history list with copy/delete
- `ModesTab.tsx` — modes CRUD with model selection

This code is **not imported anywhere** in the current app. It uses the old CSS class system, not Tailwind. It can serve as reference for the data flow and prop interfaces when building the new Vocabulary and Modes pages.

---

## Mockups

Design targets for the new settings window live in `mockups/`:

| Mockup | Files | What it shows |
|--------|-------|---------------|
| **Settings** | `mockups/settings/` | Full settings tab — provider cards, connection form, behavior section, right panel with AI modes |
| **History (v1)** | `mockups/history/` | Initial history design with right panel (session stats, weekly activity chart) |
| **History (v2 — implemented)** | `mockups/history-redesign/` | Final history design — full-width, no right panel, date grouping, metadata row, pagination |
| **Vocabulary** | `mockups/vocabulary/` | Vocabulary table with word/phonetic/type columns, search, "add new" card, right panel with dataset stats |

No mockup yet for Modes tab.

---

## What's Next

### Vocabulary tab (UI only — backend + state ready)
Build a new `VocabularyPage.tsx` in the dashboard style. The vocabulary mockup (`mockups/vocabulary/`) shows a table layout with word/phonetic/type columns, search, and an "add new word" card. The business logic (CRUD, sanitization, toggle, save) is already fully implemented in `SettingsApp.tsx` — only the UI component for the new layout needs to be built. The old `VocabularyTab.tsx` / `VocabularyEditor.tsx` / `VocabularyEntry.tsx` can serve as reference for prop interfaces and data flow.

### Modes tab (UI only — backend + state ready)
Build a new `ModesPage.tsx` in the dashboard style. No mockup exists yet — needs design. The business logic (add/update/delete modes, set active, model fetching via `fetch_provider_models`) is already fully implemented in `SettingsApp.tsx`. The old `ModesTab.tsx` can serve as reference.

### Right panel
Currently 100% decorative. Should become dynamic — connected to real modes data, real enhancement toggles, and potentially a live mic visualizer. May need rethinking per-tab (different right panel content for Settings vs Vocabulary vs Modes).

### Cleanup
- Remove placeholder user card ("Alex Chen") or replace with real branding
- Remove "PRO v2.1" badge or connect to actual version from `package.json`
- Consider removing old `SettingsPanel/` directory once new tabs are complete
