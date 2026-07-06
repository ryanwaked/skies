# Hex parity plan — closing the space-usage gap

Written 2026-07-05 from a side-by-side of Hex's notebook (rent-burden project,
dark) vs the current Skies build (`skies_demo`). Companion to
`hex-sidebar-spec.md` and `hex-measurements.json`.

## Diagnosis

Hex and Skies make opposite bets with the same pixels:

- **Hex spends pixels on content and working chrome.** A 44–48px notebook
  title *inside the canvas*, 36px section headings, a top bar carrying
  breadcrumb + run-status + restart controls, a sidebar where every row is
  one dense, non-wrapping line. Whitespace exists but is uniform and small
  (16px cell gap, ~40px section gaps).
- **The Skies build spends pixels on air and decoration.** No in-canvas
  title, cells stretched to the full viewport width (so 14px text swims in a
  150+ch measure and *reads smaller than it is*), 60–90px effective gaps
  between heading cells and their content, dotted rulers under headings,
  10px micro-labels, and a sidebar that wraps metadata onto second lines.

None of this requires abandoning the Skies identity (serif headings, mono
labels, grid-and-grain desk). It requires re-aiming where the pixels go.

---

## P0 — structural (these four ARE the "space usage" difference)

### 1. Constrain the notebook column
Hex: cells ~840px wide, centered, 40px gutter. Skies: cells fill the whole
canvas (`min-w-[500px]`, `max-width: inherit`, `px-11` gutters only).

- File: `src/components/editor/columns/cell-column.tsx:52-58`
- Fix: give the vertical-layout column `max-width: 880px` (840 content +
  2×20 frame padding) and `margin-inline: auto`. Keep `px-11` as the
  minimum gutter for narrow viewports.
- Side effect to check: wide outputs (tables, charts) — Hex lets outputs
  bleed wider than the code frame; acceptable v1 is `overflow-x: auto`
  inside the frame.
- This one change makes every existing font size read larger. Do it first
  and re-screenshot before touching type.

### 2. In-canvas title block (Hex's single biggest space feature)
Hex opens the canvas with: title (IBM Plex Sans ~44px/600/-0.04em, wraps to
2 lines), 16px muted description paragraph (max ~72ch, 1.6 line-height),
ghost "+ Add project filter" row. Skies has nothing — the canvas starts at
the first cell; the name lives only as 14px bold in the top bar.

- Files: new component, mounted above the column in
  `src/components/editor/renderers/` (vertical layout root); filename source
  already in `header/filename-form.tsx`.
- Skies voice: title in `--heading-font` (Source Serif 4) 40–44px/700/
  -0.012em/1.15; description 15–16px `--muted-foreground`, max-width 68ch;
  optional `.skies-kicker` eyebrow above the title (e.g. `// notebook`)
  instead of Hex's filter row.
- App-name fallback: filename sans extension, click-to-rename (reuse the
  existing FilenameForm behaviors).

### 3. Fix vertical rhythm (16px is already the token; the render isn't)
Cell gap is `gap-4` (16px) — same as Hex — but the *effective* gap around
heading cells is 3–5× that because margins stack: markdown headings carry
`margin-top: 1.5rem; margin-bottom: 1rem` (md.css:66-68) inside a padded
cell frame, plus the 12px ruler padding (Cell.css:347-361), plus the column
gap.

- Files: `src/css/md.css:44-69`, `src/css/app/Cell.css:347-361`
- Fix: in notebook context, first-child headings in a markdown output get
  `margin-top: 0`; heading-only cells (the section-header cells) get
  reduced internal padding so the visible rhythm is: 40px above a section
  heading, 16px below it to the first cell (mirrors Hex's ~40/16).
- Measure after: top of "Exploring the data" to top of the EXPLANATION
  frame should be ≤ 60px total.

### 4. Data browser rows must never wrap
"127 columns" wrapping to two lines under a table name is the sidebar's
worst tell. Root cause: name and meta are separate flex children with no
truncation (`datasources.tsx:916-935`, rendered `pl-6` in a wrapping flex
row).

- Files: `src/components/datasources/datasources.tsx:916-935` and the row
  layout around it; `src/components/datasources/components.tsx:19-124`.
- Fix: one grid row per tree item: `grid-template-columns: minmax(0,1fr) auto`;
  name truncates with ellipsis; meta is `whitespace-nowrap`,
  right-aligned, 11px `--foreground-dim`, and can drop the word "columns"
  when narrow (`127 cols` → `127c` is Hex-ier than a wrap).
- Then narrow the default panel width toward Hex's 293px (currently ~390px
  and still wrapping — width was never the problem).

---

## P1 — hierarchy & chrome density

### 5. Heading confidence
Sizes already roughly match Hex (36/27/20 vs Hex 36-ish), but Hex reads
bigger because of weight-in-column and the sans 600 -0.04em block feel.
Keep the serif (identity), adjust presence:

- `md.css:85-100`: after the column is constrained (fix 1), evaluate h1 at
  2.5rem/1.15 and h2 at 1.75rem. Only bump if 36px still reads light in an
  880px column.
- Kill or demote the dotted ruler (`Cell.css:347-361`): Hex headings hold
  space with size alone. If the ruler is a keeper for Skies, reserve it for
  h1 section-break cells only and thin it (1px row, not 5px band).

### 6. Cell frame labels: 10px → 12px
`10px/500/0.1em uppercase` mono reads as decoration; Hex's on-border label
is 12px/400 normal-case sans and reads as a *name*.

- File: `Cell.css` `.cell-frame-label` (top-[-8px] left-[14px] block)
- Fix: 12px, keep mono + uppercase if the Skies kicker voice matters, but
  loosen tracking to 0.06–0.08em and consider `--muted-foreground` instead
  of `--foreground-dim` for one step more presence. Line-height 18px,
  reposition `top-[-9px]`.

### 7. Code editor breathing room
Font (12px/1.5 = Hex's 12/18) already matches. The frame doesn't:
editor padding is 3px (`Cell.css:587-633`) vs Hex's ~12px inset.

- Fix: `.cm-content` padding 8px 12px; gutter `padding-inline` so line
  numbers aren't flush against the fold arrows; consider hiding fold
  chevrons until line-hover (they're per-line noise Hex doesn't have).

### 8. Top bar: fill it with working information
44px height is fine (Hex is 40). The sparseness is the gap:

- File: `src/components/editor/header/notebook-header.tsx:37-100`
- Add, left→right:
  a. Breadcrumb context before the filename (directory or "Snapshots"-style
     scope), 14px/400 `--muted-foreground`, filename as the final segment
     at 14px/500 `--foreground` (drop bold).
  b. Run-status cluster: "In Progress / Idle" text + the colored per-cell
     state bars (Hex's little green/red ticks). Cell run state already
     exists (`CellStatus.tsx`); render an 8×3px bar per cell, gap 2px,
     max ~12 bars + overflow count. This is the top bar's version of the
     minimap and the single most "filled out" element Hex has.
  c. Split "Run all": main button + chevron half exposing "Restart and run
     all" (Hex: 24px tall, 12px text, tinted bg). Marimo already has both
     commands.
- Height/padding tokens per `hex-measurements.json` topBar/notebookToolbar.

### 9. Sidebar micro-typography
Per `hex-sidebar-spec.md` §3 (already specced, not yet applied):

- Eyebrows ("DATA SOURCES"): 10px/0.12em → 11px/600/0.08em.
- Search input: `h-6 text-xs` → 28px tall, 13px text, roomier `px-2.5`.
- Row pitch 26px → 28px; primary text 13px `--foreground`, meta 11px dim.
- Panel body horizontal padding: match Hex's ~20px (currently reads ~12px
  via `px-3`), which also stops rows from feeling crowded against the edge.
- Upgrade "DUCKDB (conn)" from eyebrow text to a connection header row
  (engine icon 16px, name 13px/500, right-aligned refresh/overflow buttons,
  `conn` as a blue reference chip per spec §4/§6).

## P2 — parity polish (after the above lands)

10. Collapsed-state rows: Hex renders italic "Code collapsed" / "Result
    collapsed" placeholder rows inside the frame instead of removing the
    region. Do the same for marimo's hidden-code/collapsed-output states so
    collapsed cells still occupy honest, labeled space.
11. Left-rail minimap under the icon rail (known gap; Hex's structural
    bars). Pairs with the top-bar status ticks from fix 8b — do second.
12. Add-cell bar per `hex-measurements.json` addCellBar (74×58 items, 10px
    labels, no dividers).
13. Light theme audit — several dark values still hardcoded (known gap).
14. Altair/chart dark theming (known gap; unrelated to layout but visible
    in every screenshot comparison).

## Status (2026-07-05)

Landed and verified by screenshot at 1680×1050 dark:

- **P0-1** — `skies_demo.py` moved to `width="medium"`; the 880px
  `--content-width-medium` token already existed, the demo was just pinned
  to `full`.
- **P0-2** — `NotebookTitleBlock` (kicker / 42px serif title from
  `app_title` / mono meta row), mounted in `cell-array.tsx`, styles in
  `skies.css` (`.skies-nb-masthead`).
- **P0-3** — first/last-child heading margins zeroed in `md.css`;
  heading-only cells get `padding: 24px 0 0` (40px-above / 16px-below
  cadence) in `Cell.css`.
- **P0-4** — tree rows never wrap: name truncates, meta nowrap 11px dim
  (`datasources.tsx`, `components.tsx`).
- **P1** — ruler demoted to h1-only at 4px; cell frame label 12px/0.07em;
  editor padding 8px + gutter air + hover-only fold chevrons; header
  breadcrumb + `NotebookStatusTicks` per-cell state strip + filename
  font-medium; sidebar eyebrows 11px/600/0.08em, search 28px/13px,
  db/schema rows h-7.

Round 2 (same day, after feedback "variables too big / notebook padding
still too wide"):

- Variables table rebuilt to Hex's §5.8 layout: NAME/TYPE/VALUE
  single-line ~28px rows, 45/25/30 columns, no row borders; declared-by/
  used-by moved into the name-chip tooltip (`variables-table.tsx`).
- Column widened to Hex's ratio: `--content-width-medium:
  min(1080px, 62vw)` (was fixed 880px); wrapper gutters cut from the
  sm:px-16→xl:px-24 staircase to a flat 40px; duplicated inner
  `pb-24 sm:pb-12` removed; scroll-past-end 40vh→25vh; masthead top pad
  36→22px.

Round 3: Hex "cell outputs" strip — `cell/cell-variables-footer.tsx`
renders ↳ + type-colored chips for the variables a cell declares (green
dataframe / neutral module / blue ref, per Hex's pill semantics from
learn.hex.tech), mounted under ConsoleOutput in `notebook-cell.tsx`;
chip color variants live in `variables/common.tsx` and now also color the
variables panel. Add-cell bar items switched from fixed 64px to
min-w + padding so hover wash wraps long labels.

Note: the in-canvas masthead renders in edit mode only (`cell-array.tsx`);
read/kiosk view starts at the first cell — mount it in
`vertical-layout.tsx` too if the published view should match.

Still open: P2 items (collapsed-state rows, rail minimap, add-cell bar,
light-theme audit, chart theming) and Hex-side CDP re-measure of the
(est.) sidebar values.

## Verification loop

Per screenshot round: backend `.venv/bin/marimo edit --no-token --headless
--port 2718 hex_demo.py` (tracked background task — never `nohup`), frontend
`pnpm dev`, shots via `frontend/shot.mjs`, run-all with `Meta+Shift+r`.
Compare at identical viewport (1362×771) against `hex-measurements.json`
values, not against zoomed marketing screenshots.

Order matters: land fix 1 (column width) before judging any typography —
it changes how every size reads.
