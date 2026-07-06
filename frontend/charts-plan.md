# Charts plan — porting the Waked Binary figure language to marimo

Written 2026-07-05 after the rent-burden HBar screenshot ("I don't like the
way this looks"). Companion to `hex-parity-plan.md`. Design target:
the ryanwaked.com chart kit (`components/charts/`, reference in the site
repo's `docs/CHARTS.md`, living gallery at `/_template`) — NOT stock
vega-themes and not a literal Hex copy; Hex contributes the *layout*
behaviors (fill the cell, quiet chrome, hover-only toolbar).

## 1. Current state (research summary)

The pipeline is already centralized and theme-reactive — good bones:

- Python: `marimo/_output/formatters/altair_formatters.py` converts an
  altair Chart to a vega-lite spec (`_show_chart`, lines 42–114); theme is
  deliberately NOT applied there ("set in the vega-lite component");
  `maybe_fix_vegafusion_background` already forces transparent bg.
- Frontend: every render site — the vega plugin
  (`plugins/impl/vega/vega-component.tsx:266-278`), data-explorer, data-table
  charts, column previews, tracing, cell Output — calls
  `getSkiesVegaConfig(theme)` from
  `src/components/charts/skies-vega-theme.ts`. Theme flows from
  `useTheme()`; light/dark switching already re-renders.
- Chrome: `plugins/impl/vega/vega.css` styles the vega-embed actions menu
  and `#vg-tooltip-element` with design tokens.
- Sizing: `getContainerWidth` (vega/utils.ts:16-27) only *reads* the spec;
  nothing injects a width, so charts render at vega-lite's small defaults.
- matplotlib formatter flips to stock `dark_background`; plotly does
  nothing theme-wise.

So this is a **theme-quality** problem, not an architecture problem. One
config file plus one small spec-decorator carries almost all of the fix.

## 2. Diagnosis of the screenshot

| Symptom | Cause | Fix (section) |
|---|---|---|
| Chart ~600px in a 1040px cell, `…` button floating in dead space | no default width; vega-lite fixed default | §4 container width |
| Boxy plot frame around bars | `view.stroke` set in config | §3 view/axis |
| Prominent vertical gridlines | gridColor 9% alpha (site grid token is 4.5%) | §3 |
| Flat solid blue bars, no kit identity | `mark.color` only; no trace gradient, no bar geometry | §3 + §5 trace |
| "Los Angeles–Long Beach–Anah…" truncated | default labelLimit 180 | §3 |
| Tick marks + domain + grid = triple chrome | defaults left on | §3 |
| Gradient-looking wash on first bar | unconfirmed — likely canvas hover/selection highlight | §6 investigate |

## 3. P0 — theme deepening (skies-vega-theme.ts only)

Rewrite both configs around the kit's rules ("ink not hue", hairline
grids, mono guides). Shared shape (values shown for dark; light mirrors
with the light tokens):

```ts
{
  background: "transparent",
  padding: { left: 4, right: 8, top: 8, bottom: 4 },

  // Kit rule 3: grids are the chrome. No plot frame, no tick marks,
  // no domain except the zero baseline vega draws for quantitative axes.
  view: { stroke: null },                      // was: hairline box
  axis: {
    domain: false,
    ticks: false,
    gridColor: "rgba(220,214,232,0.055)",      // = --grid-line, was 0.09
    gridWidth: 1,
    labelColor: "#847e92",                     // --foreground-dim
    labelFont: "JetBrains Mono",
    labelFontSize: 10.5,
    labelPadding: 8,
    labelLimit: 220,                           // stop metro-name truncation
    labelOverlap: true,
    titleColor: "#bbb5c7",
    titleFont: "JetBrains Mono",
    titleFontSize: 10,
    titleFontWeight: 500,
    titlePadding: 12,
  },
  // Quantitative axes keep grid; band/point axes go bare (vega-lite
  // defaults already do this — do not force grid:true globally).

  // Kit mark geometry
  bar:   { cornerRadiusEnd: 2, color: "#5fa6ef" },
  scale: { bandPaddingInner: 0.32, bandPaddingOuter: 0.12 }, // thinner bars, real gaps
  line:  { strokeWidth: 1.6, strokeCap: "round", strokeJoin: "round" },
  point: { size: 42, filled: true, opacity: 0.9 },
  area:  { opacity: 0.22, line: { strokeWidth: 1.6 } },      // band voice
  rule:  { color: "rgba(220,214,232,0.28)" },                // zero/ref lines
  tick:  { thickness: 1.5 },
  arc:   { stroke: "#15131d", strokeWidth: 1.5 },            // donut gaps

  title: {
    font: "Source Serif 4", fontWeight: 700, fontSize: 15,
    color: "#f3f1f7", subtitleColor: "#bbb5c7", subtitleFontSize: 11,
    anchor: "start", offset: 14,               // left-aligned, like Figure shell
  },
  legend: {
    orient: "bottom", direction: "horizontal",
    labelFont: "JetBrains Mono", labelFontSize: 10.5, labelColor: "#bbb5c7",
    titleFont: "JetBrains Mono", titleFontSize: 10, titleColor: "#847e92",
    symbolSize: 60, symbolType: "square", padding: 12,
  },
  range: { category: [ /* keep current 8; see note */ ] },
}
```

Palette note: the kit is stricter than any palette — series 2+ should be
*ink*, not hues. Keep the current 8-color range as the pragmatic vega
fallback, but reorder to `[sky, copper, gold, dim-ink, …]` so a 2-series
chart is exactly the trace pair and a 4-series chart stays in-brand.
Full "fill density / hatch" identity is §5's decorator (vega-lite has no
pattern fills in config).

Also in this pass:
- `spec.ts` (data-table charts) `getBaseSpec`: drop its own
  background/grid overrides; inherit the shared config instead.
- Tooltip CSS (`vega.css` 161-176): match the site's `.chart-tip` — mono
  values, hairline border, `--popover` surface, 11px; title row muted.

## 4. P1 — layout: fill the cell, quiet the toolbar

### 4a. Default `width: "container"`

Frontend spec decorator in `vega-component.tsx` (NOT Python — keeps
exported .py portable and applies to non-altair vega specs too):

```ts
function withSkiesLayout(spec: VegaLiteSpec): VegaLiteSpec {
  // Only single-view specs: facet/repeat/concat/hconcat/vconcat break
  // with container sizing (vega-lite computes inner views itself).
  if (isCompositeSpec(spec)) return spec;
  const out = { ...spec };
  if (out.width == null) {
    out.width = "container";
    out.autosize = { type: "fit-x", contains: "padding", ...out.autosize };
  }
  if (out.height == null) out.height = 300;
  return out;
}
```

- User-set `.properties(width=…)` always wins (only fills when unset).
- CSS: `.vega-embed { width: 100% }` when `data-container-width` is
  "container" already exists (vega.css:7-10) — extend so the decorator's
  injected value takes the same path.
- Apply the same decorator at the data-explorer and column-preview sites
  ONLY if visual QA shows they need it (they set their own sizes today).

### 4b. Actions menu

- Hover-only like Hex: `.vega-embed summary { opacity: 0 }`,
  `.vega-embed:hover summary, .vega-embed[open] summary { opacity: 1 }`,
  focus-visible always visible (a11y).
- Keep export-only entries (source/compiled already off). Menu inherits
  token styling from vega.css — no change.
- After 4a the button lands on the chart's top-right instead of floating
  in dead space; verify 8px inset against the plot area.

## 5. P2 — the trace: lead-series gradient decorator

The kit's signature: **the first series paints with the copper→blue
gradient; followers stay ink.** Vega-lite supports gradient fills on mark
definitions, so extend the decorator:

- Applies when: single-view spec, mark ∈ {bar, area, line}, and NO
  `color`/`fill` channel encoding (single-series chart).
- Injects orientation-aware gradient as the mark color:
  - horizontal bar (`x` quantitative, `y` nominal): x1:0→x2:1,
    stops copper→sky (reads left-to-right like `wb-trace`).
  - vertical bar / area: y1:1→y2:0 (bottom→top).
  - line: `stroke` gradient along x.
- Colors from the same constants as the theme file (copper #d98552 /
  #a8542c, sky #5fa6ef / #1b7be4 by mode).
- Multi-series charts: untouched — categorical range from §3 applies.
- Escape hatch: skip when the user set any explicit mark color, and honor
  `usermeta.skies == false` for opting a chart out entirely.

Also in P2:
- **Renderer**: consider `renderer: "svg"` when the dataset is small
  (spec data rows < ~2000) — crisper hairlines and selectable text,
  matching the kit's SVG voice; keep canvas above the threshold. One
  heuristic in the decorator; measure before committing.
- **matplotlib**: replace stock `dark_background` with Skies rcParams
  (transparent figure/axes facecolor, `--grid-line`-alpha grid, JetBrains
  Mono ticks, spine removal, sky/copper prop_cycle) in
  `matplotlib_formatters.py:apply_theme`.
- **plotly**: register a "skies"/"skies_dark" template in
  `plotly_formatters.py` (paper/plot bgcolor transparent, mono tick font,
  same palette). Low priority — demo uses altair.

## 6. Investigation items (pin before P2 lands)

1. The pale wash on the first bar in the screenshot: reproduce with the
   rent-burden chart; suspects are canvas hover highlight, a selection
   param from `mo.ui.altair_chart` wrapping (the demo returns the raw
   chart, so more likely canvas), or the tooltip handler's cursor. Decide
   fix (disable hover mark config `mark: {cursor}` / selection opacity)
   from evidence, not guess.
2. `labelLimit` 220 vs container width on narrow panels — check the
   data-explorer's small multiples don't clip.
3. Vegafusion path (`altair_formatters.py:99-103`) returns full **vega**
   specs — the vega-lite `config` still applies via embed, but the
   decorator's spec surgery must skip mode:"vega" specs.

## 7. Verification loop

1. Add `charts_gallery.py` to the repo root: one cell per family — HBar
   (the screenshot case), column, grouped/stacked column, line multi-series,
   area, scatter, histogram, heatmap (rect), donut (arc), plus one
   `mo.ui.altair_chart`-wrapped chart (selection styling) and one
   2000×-row chart (renderer threshold).
2. Screenshot loop per `hex-parity-plan.md` (headless playwright against
   :3000, `Meta+Shift+r`, take-over guard); clip each chart cell.
3. Acceptance per figure, checked against the site gallery
   (ryanwaked.com/_template) side-by-side:
   - fills the cell column width, `…` hidden until hover
   - no plot frame; grid ≤ the site's hairline weight; no tick marks
   - mono 10.5px guides, no label truncation on the demo metros
   - single-series bar/line/area carries the trace gradient (P2)
   - light mode: same checks on warm paper (no dark-value bleed)
4. `pnpm typecheck` + existing vega plugin tests
   (`src/plugins/impl/vega/__tests__`) + a snapshot test for the decorator
   (spec-in → spec-out fixtures: plain bar, explicit width, faceted,
   multi-series, vega-mode).

## Status (2026-07-05, same day)

P0 + P1 executed and verified:

- Theme deepened in `skies-vega-theme.ts` (shared base config: no view
  frame, no ticks/domain, --grid-line-alpha grids, labelLimit 220, bar
  cornerRadiusEnd 2 + band padding, line/point/area/arc geometry,
  start-anchored Source Serif titles, bottom mono legends, palettes
  reordered [sky, copper, gold, ink, …]).
- `withSkiesLayout` decorator in `vega/utils.ts`: width:"container" +
  fit-x autosize for single-view vega-lite specs with no width; applied
  in BOTH render paths — vega-component.tsx (interactive) and
  Output.tsx (static outputs; this is the path plain `alt.Chart` cells
  use, found via DOM probe when the first pass didn't fill). Height
  deliberately never injected (band scales size row charts).
- Hover-only `…` menu (vega.css summary opacity 0 at rest), mono
  right-aligned tooltip values.
- `spec.ts` background: transparent in both modes.
- Verified: rent-burden HBar fills the column (954px canvas), full metro
  labels, both themes; 351 test files green (stale snapshots from earlier
  committed restyles updated: make-selectable brush pink→blue, CellStatus
  icons, data-frames focus-visible forms; plotly layout tests re-asserted
  for intended Skies axis-theme injection).

Post-landing fixes (found in use, same day):

- `withSkiesLayout` gained a WeakMap identity cache — react-vega re-embeds
  (destroying the live view) on any spec-identity change, and the
  un-memoized call in Output.tsx blanked charts after re-renders.
- REVERTED `bar: { cornerRadiusEnd: 2 }` from the shared config: a
  config-level corner radius silently renders NOTHING for vega-lite
  ranged bars (x/x2 binned histograms — the 80×30 table-header summary
  charts went blank while their tooltips kept working). Found by
  restoring the committed theme (bars returned) then re-adding my config
  keys in halves. Square bar ends also match the hand-drawn kit.
- Global `padding` also dropped from the shared config and the header
  minis' `createBase` got compact spec-level axis chrome
  (padding 0, labelPadding/titlePadding 2) — notebook-scale padding
  consumed the tiny plot areas.

Rule distilled: the shared config reaches EVERY vega surface, including
80×30 header minis — any geometry key added there must be verified
against the table header charts, not just notebook-size figures.

Open: P2 (trace gradient, svg heuristic, matplotlib/plotly themes), §6
investigations (first-bar hover wash not yet reproduced).

## 8. Sequencing & effort

| Phase | Scope | Files | Risk |
|---|---|---|---|
| P0 | config deepening + tooltip CSS | skies-vega-theme.ts, vega.css, spec.ts | low — pure config |
| P1 | container width decorator + hover toolbar | vega-component.tsx, utils.ts, vega.css | medium — composite-spec edge cases |
| P2 | trace gradient, svg heuristic, mpl/plotly | decorator + 2 python formatters | medium — needs the §6 investigations |

Do P0 and P1 together in one pass (they're what the screenshot complains
about), screenshot the gallery, then decide how far to push P2's gradient
against real figures.
