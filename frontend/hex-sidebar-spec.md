# Hex sidebar panel — UI spec for marimo replication

Target: replicate Hex's right-hand environment sidebar (Secrets / Environment
variables / Hex built-ins / Variable explorer) and apply the same component
language to marimo's Data browser panel.

Sources, in order of authority:

1. `hex-measurements.json` (live CDP measurements) — panel shell values
2. Extracted tokens already in `src/css/globals.css` (canvas `#1a1a23`,
   surface `#1f1f29`, border muted `#353548` / default `#42425a`, text
   `#e4e6ec` / muted `#b1b6c4`, link `#84a6e8`, success `#43d59d`, radius 3px,
   IBM Plex Sans 14 / IBM Plex Mono 12)
3. Screenshot analysis (2026-07-05) — anything marked **(est.)** was eyeballed
   from a 2× screenshot and should be confirmed with `hex-measure*.mjs` over
   CDP before being treated as exact.

---

## 1. Panel container

| Property | Value | Source |
|---|---|---|
| Width | 293px | measured |
| Background | canvas `#1a1a23` (panel is NOT elevated; same as page canvas) | measured |
| Left border | 1px solid `#353548` | token |
| Horizontal padding | 20px **(est.)** | screenshot |
| Vertical padding (top) | 20px **(est.)** | screenshot |
| Scroll | vertical only; no horizontal overflow ever (everything truncates) | screenshot |

## 2. Vertical rhythm

Sections stack with large, consistent gaps — Hex separates sections with
whitespace only, **no divider rules**.

| Gap | Value |
|---|---|
| Between sections (e.g. bottom of Secrets → "Environment variables" h2) | 40px **(est.)** |
| Section heading → helper text | 6px **(est.)** |
| Helper text → first content (eyebrow, empty state, list) | 20px **(est.)** |
| Eyebrow label → first row | 10px **(est.)** |
| List row pitch (built-ins key/value rows) | 28px **(est.)** |
| Table row pitch (variable explorer) | 28px **(est.)** |

## 3. Typography

All UI text IBM Plex Sans; all identifier/code text IBM Plex Mono.

| Role | Spec |
|---|---|
| Section heading ("Secrets", "Hex built-ins") | Plex Sans 16px / 600 / `#e4e6ec` / letter-spacing -0.02em **(est. — measured side-panel title was 14/500; these h2s render visibly larger, confirm)** |
| Helper/body text | Plex Sans 13px / 400 / `#b1b6c4` / line-height 1.45 **(est.)** |
| Inline link ("Learn more.", "See them in action.") | same as helper but `#84a6e8`, no underline at rest, underline on hover; rendered inline with the sentence, includes the period |
| Eyebrow label ("WORKSPACE SECRETS", table headers NAME/TYPE/VALUE) | Plex Sans 11px / 600 / `#b1b6c4` at ~80% (≈`#8f94a3`) / uppercase / letter-spacing 0.08em **(est.)** |
| Value text (right column of built-ins; VALUE cells) | Plex Sans 13px / 400 / `#e4e6ec` for built-ins values, `#b1b6c4` for variable-explorer VALUE cells **(est.)** |
| Masked secret value `****…` | Plex Mono 12px / 400 / `#b1b6c4` |
| Chip text | Plex Mono 12px / 400 (see §5) |

## 4. New color tokens needed (chips)

Hex color-codes identifier chips by kind. Backgrounds read as the accent color
at ~12–15% alpha over canvas; text is the accent slightly desaturated. All
values **(est.)** — sample from live DOM before finalizing.

| Token | Text | Background | Used for |
|---|---|---|---|
| `--chip-ref-text` / `--chip-ref-bg` | `#84a6e8` | `rgba(132,166,232,0.13)` ≈ `#262c3f` | built-in variables, secret names, generic references |
| `--chip-df-text` / `--chip-df-bg` | `#43d59d` (screenshot reads slightly muted, ≈`#5cc496`) | `rgba(67,213,157,0.12)` ≈ `#20312e` | DataFrame-typed variables |
| `--chip-neutral-text` / `--chip-neutral-bg` | `#e4e6ec` | `#34344a` | str/scalar variables |

Mapping rule for marimo's variable panel: DataFrame-like → green chip;
everything defined-but-plain (str, int, etc.) → neutral chip; cross-references
/ built-ins / secrets → blue chip.

## 5. Components

### 5.1 Section header row

- Flex row, `justify-content: space-between; align-items: center`.
- Left: section heading (§3).
- Right (optional): **Add button** — `+ Add`:
  - Height 26px **(est.)**, padding 0 10px, radius 3px (global).
  - Background `#2a2a38` **(est.** — elevated neutral, ~1 step above canvas**)**;
    no border visible at rest; hover: lighten to `#34344a` **(est.)**.
  - Content: plus icon 14px stroke `#e4e6ec`, 4px gap, label Plex Sans 13px /
    500 / `#e4e6ec`.

### 5.2 Helper text block

Plain paragraph (§3 helper), max-width = panel content width, wraps naturally.
Trailing inline link is part of the sentence flow, not a separate element.

### 5.3 Eyebrow label

Single line, uppercase (§3 eyebrow). Used both as a standalone group label
("WORKSPACE SECRETS") and as table column headers.

### 5.4 Identifier chip

The signature element — reuse everywhere an identifier appears (secrets,
built-ins, variable names, and in the Data browser where marimo currently
shows plain text).

- Display: inline-flex; max-width constrained by column; overflow hidden with
  **ellipsis inside the chip** (`us_gov_cen…`), never wrapping.
- Padding: 2px 6px **(est.)**; radius 3px (global token, chips do NOT get
  pill radius); no border.
- Text: Plex Mono 12px/400, color + bg per §4 variant.
- Line-height ~18px → total chip height ~22px **(est.)**.
- Not interactive-looking at rest (no underline); cursor pointer + slight bg
  lighten on hover **(assumed — verify)**.

### 5.5 Secret row

Flex row, `align-items: center`, full panel width:

1. Blue identifier chip (§5.4), flexes/truncates, min-width ~90px **(est.)**.
2. Masked value `****************` (§3), `margin-left: 12px`, flex-none.
3. Spacer (`flex: 1`).
4. Eye icon button: 24×24 hit area, 16px outline eye icon, `#b1b6c4`,
   transparent bg; hover bg `#2a2a38` radius 3px **(est.)**.
5. Overflow button: same button spec, `•••` (three-dot horizontal) icon.
6. Gap between the two icon buttons ~8px **(est.)**.

### 5.6 Empty state box

("No environment variables yet")

- Full content width; height ~56px **(est.)**; content centered both axes.
- Border: 1px **dashed** `#42425a`; radius 4px **(est. — reads a hair rounder
  than the 3px global)**; background transparent (canvas shows through).
- Text: Plex Sans 13px / 400 / `#b1b6c4`.

### 5.7 Key/value list (Hex built-ins)

Two-column grid: `grid-template-columns: minmax(0, max-content) 1fr` with
16px column gap **(est.)**, row pitch 28px, rows top-aligned to a shared
baseline.

- Left cell: blue chip (§5.4). Chips are left-aligned and ragged-right (the
  column is as wide as the longest chip, chips don't stretch).
- Right cell: value text (§3). String values render **with quotes**
  (`"logic"`, `"America/Los_Angeles"`); booleans/plain per Python repr
  (`False`); collections summarized as `4 values` / `10 values` in the same
  plain style. Truncate with ellipsis (`"example-user@exam…"`), single line.

### 5.8 Variable explorer table

Three columns NAME / TYPE / VALUE. No vertical rules, no row borders, no
zebra striping — alignment only.

- Grid: `~45% / ~25% / ~30%` of content width **(est. from screenshot:
  NAME ≈ 130px, TYPE ≈ 70px, VALUE ≈ 75px at 293px panel)**.
- Header row: eyebrow style (§3, §5.3), left-aligned each column.
- Header → first row gap: 12px **(est.)**.
- NAME cell: chip, variant by type (§4 mapping). Truncates in-chip
  (`us_gov_census_a` shown truncated with no ellipsis visible — clipped;
  use ellipsis anyway).
- TYPE cell: Plex Sans 13px / 400 / `#e4e6ec`, truncated (`DataFra…`).
- VALUE cell: Plex Sans 13px / 400 / `#b1b6c4`, truncated
  (`metropolitan_…`, `[SECRET VAL…`). Secret-backed strings display
  `[SECRET VALUE]` rather than contents.

## 6. marimo implementation mapping

| Hex element | marimo target |
|---|---|
| Panel shell (width/bg/padding/rhythm) | `src/components/editor/chrome/panels/*` shared wrapper + panel CSS |
| Secrets section | `panels/secrets-panel.tsx`, `panels/write-secret-modal.tsx` |
| Variable explorer table + chips | `panels/variable-panel.tsx`, `src/components/variables/variables-table.tsx`, `variables/common.tsx` |
| Data browser (second screenshot) restyle | `panels/datasources-panel.tsx`, `src/components/datasources/*` |
| Empty state box | `panels/empty-state.tsx` |
| Chip component (new, shared) | add e.g. `src/components/ui/identifier-chip.tsx`; consume from variables table, datasources tree, secrets panel |

### Data browser gaps visible in current theme (second screenshot)

- Column counts ("25 columns") wrap to two lines and misalign with the table
  name — Hex never wraps metadata; right-align it, single line, truncate the
  *name* instead, metadata in eyebrow-muted 11–12px.
- "DATA SOURCES" header is already eyebrow-styled — keep, but match §3
  eyebrow spec exactly (11px/600/0.08em).
- Table/schema/database rows should adopt the 28px row pitch and
  13px/`#e4e6ec` primary + muted metadata pattern from §5.7/§5.8.
- `conn` in "DUCKDB (conn)" is a candidate for a blue reference chip.

## 7. To verify over CDP (hex-measure script checklist)

All **(est.)** values above, plus specifically:

1. Section heading size/weight (16/600 vs 14/500 discrepancy with earlier
   side-panel measurement).
2. Chip padding, exact bg alphas, and hover states for the three variants.
3. Panel horizontal padding (20px?) and section gap (40px?).
4. Add-button bg pair (`#2a2a38` / hover) — likely an existing Hex neutral
   token; grab computed values.
5. Empty-state radius (3 vs 4px) and dashed border color.
