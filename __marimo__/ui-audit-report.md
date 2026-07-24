# UI Audit Report — Polish Round (multi-notebook projects branch)

Companion to `development_docs/ui-design-conventions.md` ("the convention").
Every finding has file:line, current value, and the conventional value.
Ranked by visual impact within each group: **P1** = visible on nearly every
screen / breaks theme correctness, **P2** = visible inconsistency in a
frequently used surface, **P3** = polish/detail.

Line numbers are from `feature/multi-notebook-projects` at audit time.

---

## 1. Hardcoded colors (theme-breaking) — highest priority

### 1.1 The stale `rgba(63,66,87,0.2)` hover wash — P1

A hardcoded dark-grey hover fill that matches neither theme's
`--hover-wash` (light: `rgb(21 17 42 / 5%)`, dark: `rgb(220 214 232 / 7%)`).
In light mode it is ~4× too dark; it is the single most visible
inconsistency in the chrome. Convention §1.2: `hover:bg-[var(--hover-wash)]`.

| File:line | Where |
| --- | --- |
| `frontend/src/components/editor/chrome/wrapper/sidebar.tsx:224` | rail icon buttons (every screen) |
| `frontend/src/components/editor/chrome/wrapper/footer-item.tsx:22` | rail footer items |
| `frontend/src/components/editor/chrome/wrapper/footer-items/runtime-settings.tsx:121` | rail settings button |
| `frontend/src/components/editor/chrome/wrapper/footer-items/runtime-settings.tsx:310` | settings dropdown items |
| `frontend/src/components/editor/chrome/wrapper/footer-items/lsp-status.tsx:170` | dev-panel LSP status pill |
| `frontend/src/components/editor/chrome/wrapper/footer-items/backend-status.tsx:152` | dev-panel backend status pill |
| `frontend/src/components/editor/chrome/panels/outline-panel.tsx:63` | outline mode toggle |
| `frontend/src/components/editor/chrome/panels/notebook-switcher/notebook-switcher-panel.tsx:438` | notebook switcher rows |

Suggested fix: one mechanical sweep replacing
`hover:bg-[rgba(63,66,87,0.2)]` → `hover:bg-[var(--hover-wash)]`.
Consider an oxlint/stylelint rule banning `rgba(` in className strings.

### 1.2 Hardcoded status colors — P2

| File:line | Current | Conventional |
| --- | --- | --- |
| `panels/notebook-switcher/notebook-switcher-panel.tsx:456` | running dot `bg-emerald-500` | `bg-success` (token) |
| `components/editor/actions/useNotebookActions.tsx:204` | "saved" pill `border-emerald-200 bg-emerald-50 text-emerald-700` (light-only, breaks dark mode) | success-token equivalents (`border-success/40 bg-success/10 text-success`) |
| `components/editor/ai/ai-completion-editor.tsx:433,440` | spinner/check `text-blue-600` / `text-green-600` | `text-primary` / `text-success` |
| `chrome/wrapper/app-chrome.tsx:133-134` | `TerminalSkeleton` inline `#15131d`/`#ffffff`/`#8f89a3`/`#75707f` | acceptable (deliberate xterm-theme match, documented), but could read `var(--card)`/`var(--foreground-dim)` for the light path |

Brand icons in `connections/database/add-database-form.tsx` and
`connections/storage/add-storage-form.tsx` (vendor logo hexes) are
intentional — exempt.

---

## 2. Notebook switcher panel (new feature — off-system in several places)

The panel works but bypasses the shared panel system more than any other
panel. Convention §4.1/§2.1.

| # | File:line | Current | Conventional | Rank |
| --- | --- | --- | --- | --- |
| 2.1 | `notebook-switcher-panel.tsx:185-227` | bespoke search header: raw `Input` at `h-6 … text-xs` with hand-placed 12px search/clear icons | `PANEL_SEARCH_ROW` + `PANEL_SEARCH_INPUT_ROOT` + `PANEL_SEARCH_INPUT` (h-7 pill, 13px text) + `PANEL_SEARCH_ACTION` buttons | P2 |
| 2.2 | `notebook-switcher-panel.tsx:434` | rows `h-6 … text-xs` (24px / 12px) | standard list row `min-h-[26px] … text-[13px]` | P2 |
| 2.3 | `notebook-switcher-panel.tsx:438` | `hover:bg-[rgba(63,66,87,0.2)]` | `hover:bg-[var(--hover-wash)]` | P1 (dup of 1.1) |
| 2.4 | `notebook-switcher-panel.tsx:456` | `bg-emerald-500` running dot | `bg-success` | P2 (dup of 1.2) |
| 2.5 | `notebook-switcher-panel.tsx:281-292` | bespoke empty state (`items-start … text-xs`), left-aligned | `PanelEmptyState` (centered, 13px, `action` slot for the create button) | P3 |
| 2.6 | `notebook-switcher-panel.tsx:356-357` | section header duplicates `PANEL_EYEBROW` as a local `SECTION_HEADER_CLASS` | import `PANEL_EYEBROW` from `../panel-styles` | P3 |
| 2.7 | `notebook-switcher-panel.tsx:389` | folder group label `text-muted-foreground/80` | `text-muted-foreground` (alpha variants on tokens are off-scale) | P3 |

---

## 3. Rail, chrome, top bar

| # | File:line | Current | Conventional | Rank |
| --- | --- | --- | --- | --- |
| 3.1 | `header/notebook-header.tsx:278` | `TopBarUndo` button `h-[24px] w-[24px]` | 28×28 to match the top-bar action cluster (`h-[28px]`, like `ShareButton` and `QueuedCellsIndicator`) | P2 — visibly shorter than its neighbors |
| 3.2 | `header/notebook-header.tsx:169` | status-dot button `size-5` (20px target) | 24px minimum click target in the bar; keep dot visual at 6px | P3 |
| 3.3 | `chrome/wrapper/app-chrome.tsx:398` | `mr-[-4px]` negative-margin hack on the helper pane body | the resize handle (4px) should sit in layout, not be compensated by a magic negative margin | P3 |
| 3.4 | `chrome/wrapper/app-chrome.tsx:340,351` | resize handles `z-10` / `z-20` raw numbers | documented scale (`z-sticky` not needed here — in-layout handles can be z-auto; if stacking is required, use the scale) | P3 |
| 3.5 | `chrome/wrapper/sidebar.tsx:154` | rail `z-50` raw | z-scale utility or none (rail is in normal flow) | P3 |
| 3.6 | `chrome/wrapper/sidebar.tsx:274` | error badge absolute `-right-2 -top-1.5`, `text-[9px]` over a 16px icon | keep position but badge should be `min-w-[14px]` for two-digit counts; currently 12px clips "10+" | P3 |
| 3.7 | `chrome/wrapper/app-chrome.tsx:138` | `TerminalSkeleton` cursor `animate-pulse` without `motion-safe:` | `motion-safe:animate-pulse` (convention §5.3) | P2 (a11y) |
| 3.8 | `header/notebook-header.tsx:306` | queued-cells spinner `animate-spin` without `motion-safe:` | `motion-safe:animate-spin` | P2 (a11y) |

Dev-panel header (`app-chrome.tsx:548-601`) mixes 32px row with `text-sm`
tabs and `rounded-sm` — acceptable, but the selected tab fill `bg-muted`
should be the standard `bg-primary/[0.07] text-primary` selection (P3).

---

## 4. Panels (general)

| # | File:line | Current | Conventional | Rank |
| --- | --- | --- | --- | --- |
| 4.1 | `panels/snippets-panel.tsx:168`, `panels/components-panel.tsx:298`, `panels/secrets-panel.tsx:367` | each panel renders its own bordered title bar (`text-[13px] font-medium … border-b px-3 py-1.5`) directly under the chrome's 30px panel-title row | panels never render their own title bar; drill-in headers should be a toolbar row (`PANEL_TOOLBAR_ROW`) with a back/close affordance | P2 — double-stacked headers read as two title bars |
| 4.2 | `panels/outline-panel.tsx:63` | `rgba(63,66,87,0.2)` hover in mode toggle | `PANEL_SEGMENTED_ITEM` + ACTIVE/INACTIVE constants | P2 |
| 4.3 | `panels/outline-panel.tsx:60` | mode toggle buttons `h-[18px] text-[12px]` | `PANEL_SEGMENTED_ITEM` (`px-2 py-0.5 text-xs`) | P3 |
| 4.4 | `panels/packages-panel.tsx:545` | tree indent mixes two systems: top level CSS `px-2`, children inline `16 + level * 16`px | one system (inline indent for all levels, or CSS for all) | P3 |
| 4.5 | `panels/packages-panel.tsx:509,518` | every top-level dependency wrapped in `border-b` | section hairlines only between accordion sections; tree rows should rely on row hover, not per-row rules | P3 |
| 4.6 | `panels/secrets-panel.tsx:242` | fixed `w-[55%]` list / 45% detail split | at sidebar min (220px) the list is ~121px wide and key chips truncate to a few chars; consider stacking detail below list under ~340px, or min-width guard | P2 — cramped at narrow widths |
| 4.7 | `panels/error-panel.tsx:21` | per-error group header `text-xs font-code font-medium` | `PANEL_EYEBROW` (mono eyebrow) for group headers | P3 |
| 4.8 | `panels/file-explorer-panel.tsx:62-63` | `TRIGGER_HEIGHT = 28` magic number coupled to trigger styles by comment | derive from a shared constant or measure; will drift silently | P3 |
| 4.9 | `panels/context-aware-panel/context-aware-panel.tsx:70,78` | fixed `w-64` text spans in the panel header | `min-w-0 truncate` flex layout; fixed 256px assumptions overflow at narrow widths | P2 |
| 4.10 | `panels/context-aware-panel/context-aware-panel.tsx:114` | close icon `hover:text-destructive` | close = neutral `hover:text-foreground`; red is reserved for destructive actions | P3 |
| 4.11 | `panels/outline/floating-outline.tsx:43` | fixed `w-[300px]` absolute overlay, `rounded-lg` (maps to 3px, fine) | cap with `max-w-[calc(100vw-...)]` or make width fluid; 300px fixed can overflow small viewports | P3 |
| 4.12 | `panels/cache-panel.tsx:118` | `animate-[spin_0.5s]` without reduced-motion guard | `motion-safe:` prefix | P3 |
| 4.13 | `panels/search-panel.tsx` | good reference implementation — uses `PANEL_SEARCH_ROW`/`PANEL_SEARCH_INPUT_ROOT`, 13px rows, hover-wash | — (no action) | — |

---

## 5. Home page & home components

| # | File:line | Current | Conventional | Rank |
| --- | --- | --- | --- | --- |
| 5.1 | `home/notebook-row.tsx:34` (`NOTEBOOK_ROW_ITEM_CLASS`) | row hover `hover:bg-accent/50 hover:text-accent-foreground` (blue accent wash + blue text — a *selection* color used as hover) | `hover:bg-[var(--hover-wash)]` | P1 — every home row hover reads as "selected" |
| 5.2 | `home/notebook-row.tsx:34` | `rounded-l` (4px left-only radius) | `rounded-[3px]` (single 3px radius, both sides or none) | P2 |
| 5.3 | `home/notebook-row.tsx:73-76` | `ExternalLinkIcon size={20}` (lucide `size` prop, 20px) | className sizing `h-4 w-4` + `strokeWidth={1.5}` (16px convention) | P2 — oversized vs every other row affordance |
| 5.4 | `home/notebook-row.tsx:132` | `PowerOffIcon size={14}` | `className="h-3.5 w-3.5" strokeWidth={1.5}` | P3 |
| 5.5 | `home/collections.tsx:267` | collection row file icon `w-5 h-5` (20px) in a 26px row | `h-3.5 w-3.5`–`h-4 w-4` per icon scale | P2 — rows look icon-heavy |
| 5.6 | `home/collections.tsx:121` | "New collection" button `hover:bg-primary/10` | `hover:bg-[var(--hover-wash)]` (hover) — primary tint is selection-only | P3 |
| 5.7 | `pages/home-page.tsx:679,761` | sidebar items `rounded-[4px]` | `rounded-[3px]` | P2 |
| 5.8 | `pages/home-page.tsx:753` | inline rename input `rounded-[4px]` | `rounded-[3px]` | P3 |
| 5.9 | `pages/home-page.tsx:953` | grid/list toggle `rounded-[4px]` | `rounded-[3px]` | P3 |
| 5.10 | `pages/home-page.tsx:944` | search input fixed `w-56` | fluid `flex-1 min-w-0 max-w-56` so it survives narrow viewports | P2 |
| 5.11 | `home/collections.tsx:52` (`SectionLabel`) | `text-[var(--foreground-dim)]` for the "Collections" label | fine per convention §2.3 (non-interactive meta), but note it diverges from panel eyebrows (`muted-foreground`); keep as-is consciously | P3 (document only) |
| 5.12 | `home/notebook-mini-preview.tsx:210,214` | `motion-safe:animate-pulse` | reference implementation — no action | — |
| 5.13 | `pages/home-page.tsx:1358` | card hover with `motion-reduce:transition-none motion-reduce:hover:transform-none` | reference implementation for transform hovers — replicate this pattern elsewhere | — |

---

## 6. Shared UI primitives (`components/ui/`)

| # | File:line | Current | Conventional | Rank |
| --- | --- | --- | --- | --- |
| 6.1 | `ui/input.tsx:139` | `placeholder:text-foreground-muted` — **dead class**: no `foreground-muted` token exists in the Tailwind theme, so search placeholders silently fall back to inherited color | `placeholder:text-muted-foreground` | P1 (broken style, invisible until you look for it) |
| 6.2 | `ui/input.tsx:39` | base `Input` hard-codes `mb-1` and `h-6 … text-sm` | margin belongs to the caller; panel convention is h-7 pill + `text-[13px]` (`PANEL_SEARCH_INPUT`) | P2 — surprise margin breaks layouts that wrap `Input` |
| 6.3 | `ui/input.tsx:133` | `SearchInput` root `flex items-center border-b px-3` baked in, then overridden by `PANEL_SEARCH_INPUT_ROOT` in panels | root styling should come only from `rootClassName`; default should be borderless | P3 |
| 6.4 | `ui/skeleton.tsx:10` | `animate-pulse` with no reduced-motion guard | `motion-safe:animate-pulse` | P2 (a11y — every loading state in the app pulses) |
| 6.5 | `ui/toast.tsx:19` | viewport `z-100` raw | `z-toast` utility from the documented scale | P2 |
| 6.6 | `ui/menu-items.tsx:8`, `ui/select.tsx:76`, `ui/dialog.tsx:26,45,66`, `ui/tooltip.tsx:34`, `ui/alert-dialog.tsx:20,35,57`, `ui/popover.tsx:48`, `ui/sheet.tsx:26,36`, `ui/aria-popover.tsx:20`, `ui/styles.ts:56` | raw `z-50` everywhere despite the documented `--z-*` scale (`globals.css:144-154`) | `z-dropdown` / `z-modal` / `z-tooltip` / `z-overlay` per layer | P2 — the scale exists precisely so dropdown < modal < toast < tooltip; raw 50s defeat it |
| 6.7 | `ui/toast.tsx:78` | `ToastAction` uses `focus:ring-2 focus:ring-ring focus:ring-offset-2` | global inset 1px ring (`skies.css :focus-visible`); ring-offset shadows are off-language | P3 |
| 6.8 | `ui/toast.tsx:93` (`ToastClose`) | `focus:ring-2` + `rounded-lg` (fine, maps to 3px) | same focus-ring simplification | P3 |

---

## 7. Motion violations (convention §5)

| # | File:line | Issue | Fix | Rank |
| --- | --- | --- | --- | --- |
| 7.1 | `ui/skeleton.tsx:10`, `app-chrome.tsx:138`, `cache-panel.tsx:118`, `notebook-header.tsx:306` | unguarded pulse/spin | `motion-safe:` prefix | P2 |
| 7.2 | `outline/floating-outline.tsx:43` | `transition-all duration-300` on an absolutely-positioned overlay | transition only `transform`/`opacity` at ≤250ms | P3 |
| 7.3 | `chrome/wrapper/sidebar.tsx:319` | resource bar `duration-500` width tween | allowed per convention (data tween), keep | — |
| 7.4 | global | no global `@media (prefers-reduced-motion: reduce)` reset; only `skies.css` (2 blocks) and `app-chrome.css` guard motion | add a global reset in `globals.css` (`*, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }` under the media query) OR keep per-component `motion-safe:` — pick one; the per-component approach is current practice but is being forgotten (7.1) | P2 |
| 7.5 | `packages-panel.tsx:245` | tooltip `delayDuration={300}`; rail uses `delayDuration={200}` (sidebar.tsx:240,313) | standardize on 200ms for chrome tooltips | P3 |

---

## 8. Cramped spots, overlaps, z-index & truncation risks (static analysis)

1. **Secrets panel split view** (`secrets-panel.tsx:242`): 55/45 fixed split
   inside a 220–293px sidebar — both panes truncate heavily below ~340px.
   Worst cramped spot found. (P2, see 4.6)
2. **Rail error badge** (`sidebar.tsx:273-277`): absolutely positioned over
   the icon corner; 12px min-width clips 2-digit counts. (P3)
3. **Switcher action dropdown width** (`notebook-switcher-panel.tsx:463`):
   `w-[220px]` menu equals the sidebar *minimum* width — fine at default
   293px, edge-to-edge at min; use `min-w-[180px] w-fit` like collections.
   (P3)
4. **Top-bar crowding**: with undo + queued indicator + run-all + share +
   save + history + config + shutdown, the right cluster is ~8 controls;
   below ~1100px the breadcrumb + filename shrink to truncation. Acceptable,
   but `HeaderBreadcrumb` should hide below `lg` (currently `sm:flex`). (P3)
5. **Context-aware panel header** (`context-aware-panel.tsx:70,78`): fixed
   `w-64` spans overflow when the panel is dragged narrow. (P2, see 4.9)
6. **Floating outline** (`floating-outline.tsx:43`): 300px fixed overlay
   can overflow small windows; also sits at `absolute` with default z —
   risk of sliding under sticky cell chrome; give it `z-overlay`. (P3)
7. **File-explorer drop overlay** (`file-explorer-panel.tsx:51`): `z-10`
   inside the panel — fine per convention; no action.
8. **`Sidebar` rail `z-50`** (`sidebar.tsx:154`): higher than overlays in
   the documented scale's *intent* for in-flow chrome; combined with raw
   `z-50` dropdowns, a dropdown opening from the rail relies on both being
   50 — fragile. Fixing 6.5/6.6 resolves this. (P2)

---

## 9. Strange UI logic (flows worth rethinking)

1. **"Reveal in file explorer" doesn't reveal.**
   `notebook-switcher-panel.tsx:179-181` (`revealInFileExplorer`) just calls
   `openApplication("files")` — it opens the Files panel but never scrolls
   to, expands, or highlights the notebook. The menu item
   (`notebook-switcher-panel.tsx:469-472`) promises a reveal that doesn't
   happen. Either implement actual reveal (expand folders + scroll + flash
   the row) or rename the item "Open file explorer".

2. **Two different "open in new tab" semantics.** Home rows use
   `tabTarget()` (`home/notebook-row.tsx:21-23`) so re-clicking a notebook
   reuses its tab; the switcher's "Open in new tab" uses
   `openNotebook()` (`utils/links.ts:8-11`) with bare `_blank`, spawning a
   fresh tab (and a fresh kernel session) every click. Same gesture, two
   outcomes — unify on `tabTarget` behavior.

3. **Two "titles" in two places.** The filename is edited inline in the top
   bar (`header/filename-form.tsx`), but the app title is buried in
   Settings → App title (`app-config/app-config-form.tsx:116-120`). Users
   renaming a notebook will not discover the app title; consider surfacing
   app title near the filename (e.g. in the notebook menu) or merging the
   concepts in present mode.

4. **Switcher rows can shift under the cursor.** The 10s poll
   (`notebook-switcher-panel.tsx:54,80-83`) refetches *everything* —
   recents reorder and running entries appear/disappear while the user is
   about to click. Poll running status only, or preserve row order between
   polls. (Also: `RUNNING_POLL_INTERVAL_MS` duplicates the home page's
   interval constant — share it.)

5. **Panels silently auto-open accordion sections.** Both
   `file-explorer-panel.tsx:73-81` and `session-panel.tsx:47-51` force-open
   a section on load when data exists ("hasUserInteracted" escape hatch).
   Opening the panel can therefore jump/layout-shift on first view.
   Consider defaulting to the user's last state only.

6. **Same notebook, many kernels.** Nothing in the switcher warns when
   opening a notebook that's already running in another tab without
   `session_id` reuse (only *running* items pass `sessionId`;
   `navigationTarget` in `notebook-switcher-utils.ts`). Recent/All items for
   a running notebook get a session resume, but the "Open in new tab" item
   (via `openNotebook`) never does — a second kernel starts silently.

7. **Packages tree resets expansion on every refetch**
   (`packages-panel.tsx:471-473`): after install/remove, the whole tree
   collapses — disorienting mid-task. Preserve `expandedNodes` across
   refetches where nodes still exist.

8. **Outline mode toggle placement** (`outline-panel.tsx:54`): the toggle
   is right-aligned (`justify-end`) with no left label, floating in a bare
   row — reads as orphaned. Conventional: `PANEL_TOOLBAR_ROW` with
   `justify-between` (label left, toggle right).

---

## 10. Suggested implementation order for the follow-up agent

1. **Sweep 1 (mechanical, ~15 min):** 1.1 rgba hover → hover-wash (8
   files); 5.1 accent hover → hover-wash; 1.2 status colors → tokens.
2. **Sweep 2 (switcher alignment):** section 2 items 2.1–2.6 — move the
   switcher onto `PANEL_SEARCH_*`, 13px/26px rows, `PANEL_EYEBROW`,
   `PanelEmptyState`, `bg-success`.
3. **Sweep 3 (a11y/motion):** 6.4, 7.1 `motion-safe:` prefixes; 7.4 decide
   global reduced-motion reset.
4. **Sweep 4 (z-scale):** 6.5, 6.6, 3.5 — replace raw z values with scale
   utilities.
5. **Sweep 5 (headers & radius):** 4.1 duplicate title bars → toolbar rows;
   5.2/5.7–5.9 radius; 3.1 undo button size; 6.1 dead placeholder class;
   6.2 Input `mb-1`.
6. **Logic fixes (product decisions needed):** 9.1 reveal, 9.2 tab reuse,
   9.4 poll churn, 9.6 duplicate-kernel guard, 9.7 expansion reset.

Items 5.12, 5.13, 4.13, and `skies.css`/`app-chrome.css` are the reference
implementations — copy from them, don't "fix" them.
