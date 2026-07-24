# marimo UI Design Conventions (Skies)

This document codifies **one** typography, color, spacing, and motion
convention for the whole marimo UI. It is a standardization of what the
codebase's best surfaces already do (the Skies design language in
`frontend/src/css/app/skies.css`, the rail panel system in
`frontend/src/components/editor/chrome/panels/panel-styles.ts`, and the
top bar in `frontend/src/components/editor/header/notebook-header.tsx`) —
not a redesign. Where the codebase disagrees with itself, this document is
the tiebreaker; `__marimo__/ui-audit-report.md` lists the code that must
move onto these rules.

Design language summary: warm-paper flat surfaces, hairline ink borders, a
single 3px radius, JetBrains Mono labels, Source Serif display headings,
and only two saturated accents (sky blue `--primary`, copper `--copper`)
plus gold and the semantic status tones. No offset shadows; only overlays
(menus, popovers, dialogs) keep soft elevation.

---

## 1. Color & surfaces

### 1.1 Tokens only

All colors come from theme tokens (`globals.css` `:root`); never hardcode
hex/rgba in components. The Tailwind color scale is wired to these tokens
(`tailwind.config.cjs`), so prefer utility classes:

- Surfaces: `bg-background` (desk/canvas), `bg-card` (panel/paper),
  `bg-popover` (overlays), `bg-muted`, `bg-secondary`.
- Ink: `text-foreground`, `text-muted-foreground` (secondary/interactive
  text), `text-[var(--foreground-dim)]` (meta/mono labels — see 2.3).
- Accents: `text-primary`/`bg-primary`, `text-destructive`/`bg-error`,
  `text-success`, `text-action-foreground` (amber "in progress"),
  `text-[var(--gold)]`, `text-[var(--copper)]`.
- Status dots and semantic fills use tokens: `bg-success`, `bg-error`,
  `bg-action-foreground`. Never `bg-emerald-500`/`text-green-600` etc.

### 1.2 Hover and selection (the two-state system)

There are exactly two row states, reused everywhere:

- **Hover (neutral):** `hover:bg-[var(--hover-wash)]` — a faint neutral ink
  wash defined per theme in `--hover-wash`. If the hover needs an ink
  change too, add `hover:text-foreground` (resting secondary text is
  `text-muted-foreground`).
- **Selected/current (tinted):** `bg-primary/[0.07] text-primary` — the
  sky-blue tint, never a solid fill.

**Forbidden:** `hover:bg-[rgba(63,66,87,0.2)]` (a stale, dark-mode-only
hardcode that is wrong in both themes), `hover:bg-accent/50`,
`hover:bg-primary/10`, `hover:bg-muted/50` as row hovers. (`bg-accent` is
reserved for inline code/key chips, see 4.4.)

### 1.3 Borders & dividers

- All borders are hairlines on the token: `border-border` (default),
  `border-input` only where a slightly stronger edge is needed
  (`.skies-paper`, CTA buttons).
- `*` already defaults to `border-border` (globals.css), so write
  `border-b` / `border-t` without repeating the color.
- Dividers between stacked panel rows/sections are `border-b border-border`
  on the section, with the last section removing it (`border-b-0`), as in
  `PanelAccordionItem`/`lastItem`.
- Vertical separators in toolbars: `h-[18px] w-px bg-border` with `mx-1`
  (top bar convention) or `h-4` in the 32px dev-panel header.
- Radius is a single 3px everywhere: `--radius: 3px`, and Tailwind
  `rounded-sm/md/lg` all map to it. Write `rounded-[3px]` (or `rounded-md`)
  — never `rounded-[4px]`, `rounded-l`, `rounded-[2px]` (except the 2px
  `<mark>` highlight), or one-off radii.

### 1.4 Focus

Keyboard focus is the global inset ring from `skies.css`
(`:focus-visible { outline: 1px solid var(--primary); outline-offset: -1px; }`).
Do not add competing `focus:ring-2` styles; the design-system `focusRing`
in `ui/styles.ts` is the allowed override for inputs/buttons.

### 1.5 Stacking (z-index)

One documented scale (`globals.css`): consume the Tailwind utilities
`z-dropdown`, `z-sticky`, `z-overlay`, `z-modal`, `z-toast`, `z-tooltip`.
Raw `z-50`/`z-100`/`z-10`/`z-20` are forbidden in new code; in-panel
floaters (hover action buttons, drop overlays) use `z-10` only, inside a
`relative` parent.

---

## 2. Typography

### 2.1 Type scale (rail panels & chrome)

| Role | Class | Notes |
| --- | --- | --- |
| Panel section header / eyebrow | `text-[10px] font-mono font-medium uppercase tracking-[0.12em] text-muted-foreground` | the `PANEL_EYEBROW` / `PanelAccordionTrigger` voice |
| Panel title (chrome header) | `text-sm font-medium text-foreground` (14px) in the 30px row | owned by `app-chrome.tsx`, panels don't repeat it |
| Primary rows (trees, lists, tables) | `text-[13px]` (13px, not `text-xs`=12, not `text-sm`=14) | the panel body voice |
| Secondary/metadata inline with rows | `text-xs text-muted-foreground`; mono values `font-code text-xs` | versions, timestamps, paths |
| Mono meta in trees/search groups | `font-code text-[11px] text-muted-foreground` | search result groups, outline cell names |
| Inputs & search pills | `text-[13px]` inside an `h-7` pill (`PANEL_SEARCH_INPUT`) | placeholder `placeholder:text-muted-foreground` |
| Buttons (default) | `text-sm font-medium`; panel-toolbar buttons `text-xs` | see 4.2 |
| Badges/chips | `text-[10px] py-0 px-1.5` (`PanelBadge`); bordered tags `text-[10px] font-medium px-1.5 py-0 rounded-[3px] border` | uppercase mono only for eyebrows, not tags |
| Empty states | title `text-[13px] font-medium text-muted-foreground`, body `text-[13px] leading-5 text-muted-foreground max-w-[260px]` | `PanelEmptyState` |
| Rail dev-panel tabs | `text-sm` | bottom panel header |

Rules of thumb: **13px is the panel body size** — `text-xs` (12px) is
only for secondary metadata and compact toolbar buttons, never for primary
list rows. `text-sm` (14px) is chrome (top bar, panel titles, dev-panel
tabs), not panel content.

### 2.2 Home page

| Role | Class |
| --- | --- |
| Section label | `SectionLabel`: `font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--foreground-dim)]` |
| Hero title | `.skies-hero-title` (Source Serif 34px/700/-0.012em) |
| Section headings ("Good evening", counts) | `font-[family-name:var(--heading-font)]` with `tracking-[-0.012em]` |
| Card/row title | `text-[13px] font-medium text-foreground` |
| Card/row meta (dates, counts) | `font-mono text-[10px] tabular-nums text-[var(--foreground-dim)]` (10.5px allowed for the wide timestamp column) |
| Mono sub-labels on cards | `font-mono text-[11px] text-[var(--foreground-dim)]` |

### 2.3 The two muted inks (settle on this rule)

- `text-muted-foreground` — **interactive** secondary text: anything that
  brightens to `text-foreground` on hover, plus placeholders and empty
  states, plus panel eyebrows (`PANEL_EYEBROW`).
- `text-[var(--foreground-dim)]` — **non-interactive** mono meta: home-page
  timestamps/counts, `.skies-kicker`, `.skies-paper-meta`, mini-preview
  labels. It is dimmer than `muted-foreground` and never appears on
  hover targets.

When in doubt, use `muted-foreground`.

### 2.4 Font families

- Sans (`--text-font`, Tailwind default `font-sans`/unset): all UI text.
- Mono (`font-mono`/`font-code` → `--monospace-font`, JetBrains Mono):
  eyebrows/section labels, code, versions, timestamps, file paths, log
  output, kbd hints, numeric meta (`tabular-nums`). Mono meta is always
  paired with a dim ink (2.3).
- Serif (`--heading-font`, Source Serif 4, `font-[family-name:var(--heading-font)]`):
  **display headings only** — home hero, section headings, notebook
  masthead, mini-preview titles. Never in the editor chrome, panels,
  buttons, or forms.

---

## 3. Icons

- Library: lucide-react only, always `strokeWidth={1.5}`.
- Sizes (Tailwind classes, never the lucide `size=` prop):
  - **12px (`h-3 w-3`)**: icons inside eyebrows/accordion triggers
    (`PanelAccordionTrigger` enforces `[&>svg]:h-3 [&>svg]:w-3`), folder
    group labels, inline adornments inside inputs.
  - **14px (`h-3.5 w-3.5` / `size-3.5`)**: row-leading icons and row action
    buttons in dense panels, dropdown menu items, panel toolbar buttons.
  - **16px (`h-4 w-4`)**: the icon rail, top bar, dev-panel tabs, dialog
    and search-pill leading icons (`SearchInput` default), empty-state
    glyphs (`PanelEmptyState` clones to `h-4 w-4`).
- Icon color follows the text rule: row-leading icons in inactive rows are
  `text-muted-foreground`; in the selected row `text-primary`; in the rail
  (large targets) icons rest at `text-foreground`.

---

## 4. Layout & component geometry

### 4.1 Row heights & padding (dense panel rhythm)

- **Standard tree/list row:** `min-h-[26px]` (26px), `rounded-[3px]`,
  horizontal inset `mx-1.5` when rows float inside the scroll area
  (file-explorer/switcher style) or full-bleed `px-2`/`px-3` when rows are
  divided by hairlines (packages/search style). Pick one per panel; the
  inset style is preferred for new work.
- **Compact row:** `h-6` (24px) is allowed only for the most compact
  utility rows (secrets action rows); primary navigable lists use 26px.
- **Row internals:** `flex items-center gap-1.5`, leading icon, label
  `flex-1 truncate` (with `title={fullPath}` for paths), trailing meta or
  hover-revealed actions (`invisible group-hover:visible` or
  `opacity-0 group-hover:opacity-100`).
- **Section header row:** `px-3 py-1.5` eyebrow (2.1); accordion sections
  use `PanelAccordionTrigger`.
- **Panel search/toolbar rows:** `PANEL_SEARCH_ROW` /
  `PANEL_TOOLBAR_ROW` (`flex items-center gap-1 w-full px-2 py-1.5 border-b
  shrink-0`) with the pill `PANEL_SEARCH_INPUT_ROOT` (`flex-1 h-7 px-2.5
  rounded-[3px] border bg-card`) and square `PANEL_SEARCH_ACTION`
  (`h-7 w-7`) icon buttons. **Every panel with a filter field must use
  these constants** — no bespoke search inputs.
- **Panel chrome header:** the 30px title row (`px-3 h-[30px] border-b
  flex justify-between items-center`, title `text-sm font-medium`, close
  button `size="xs" variant="text"`) belongs to `app-chrome.tsx` alone.
  Panels must not render their own bordered title bars beneath it.
- **Rail geometry:** rail column `w-[44px]`, items 36×36px
  (`h-[36px] w-[36px] rounded-[3px]`), 16px icons, flush pitch (gap-0).
- **Top bar geometry:** `h-[44px]`; every control in the action cluster is
  **28px tall** (`h-[28px]`, icon buttons 24×24 are forbidden — see audit).
- **Sidebar width bounds:** min 220px / default 293px / max 640px
  (`app-chrome.tsx` constants). Content must not rely on a fixed pixel
  width; use `truncate`, `min-w-0`, and `max-w-fit` instead.

### 4.2 Buttons

- Use the design-system `Button` (`ui/button.tsx`). Panel toolbars prefer
  `variant="text" size="xs"` or the `PANEL_SEARCH_ACTION` square button.
- The top bar CTA voice is `.skies-cta` (paper, hairline, mono) at 28px.
- Segmented controls use `PANEL_SEGMENTED_ITEM` + ACTIVE/INACTIVE (pill
  toggle; active = `bg-primary/[0.07] text-primary`).
- Destructive actions are quiet: `text-destructive` text/outline treatment
  or `.skies-cta--danger`; no solid red fills outside the confirm dialog's
  `AlertDialogDestructiveAction`.

### 4.3 Empty states

Always `PanelEmptyState` (centered, `px-6 py-10`, 16px muted icon, 13px
title/body, optional action slot). Don't hand-roll empty markup; pass the
primary action through the `action` prop.

### 4.4 Chips, keys, inline code

- Inline code/keys/secret names: `font-code text-[11.5px] rounded-[3px]
  bg-accent px-1.5 py-0.5 text-accent-foreground` (the accent-wash chip).
- Count badges in section headers: `PanelBadge`.
- Bordered tags (cycle/extra/group): bordered `text-[10px] font-medium`
  with a 40%-alpha semantic border (`border-success/40 text-success` etc.).
- Type chips on home cards: `.skies-type-chip` variants.

### 4.5 Loading

- Use `Skeleton` (`bg-muted animate-pulse rounded-md`) shaped like the
  final rows (skeletons must match row heights) — see the notebook
  switcher's `LoadingSkeleton` as reference.
- All pulse/spin animation is wrapped in `motion-safe:` (see 5.4).
- Inline spinners: `Spinner size="small"` in place of the action icon, at
  the icon's own size, `opacity-50`.

---

## 5. Motion

The Skies language is calm: quick, low-amplitude, mostly `ease-out`.
One standard easing and four durations cover everything.

### 5.1 Standard easing & durations

- **Standard ease:** `cubic-bezier(0.22, 0.61, 0.36, 1)` (the Skies ease;
  Tailwind `ease-out` is an acceptable stand-in for simple color fades).
- **Hover/focus color shifts:** `transition-colors` (150ms default). Color
  hovers never exceed 150–250ms; use `transition-colors` unless multiple
  properties animate.
- **Micro-movement hovers** (card lift, arrow nudge): 150–180ms,
  `duration-150 ease-out`, amplitude ≤ 2px (`hover:-translate-y-px`,
  `group-hover:translate-x-0.5`).
- **Panel open/close:** 250ms ease on `flex-grow`
  (`.sidebar-panel-animating`, applied only around programmatic toggles —
  never during drag-resize). Accordions: `animate-accordion-down/up`
  (200ms ease-out).
- **View/page transitions & overlays:** Radix `animate-in/animate-out`
  fade+slide/zoom (150–300ms). Sheet/drawer slides keep 300–500ms as today.
- **Toasts:** enter `slide-in-from-bottom-full` + fade (sm breakpoints),
  exit `slide-out-to-right-full` + `fade-out-80` (`ui/toast.tsx`) — do not
  add extra transitions beyond `transition-all` on swipe states.
- **Skeleton shimmer / spinners:** `animate-pulse` / `animate-spin`;
  resource bars may tween width at `duration-500`.
- **Ambient loops** (sky drift, twinkle, ping): slow (≥1.8s), decorative
  only, behind `pointer-events: none`.

### 5.2 Forbidden animation

- No layout-thrashing transitions: never `transition-all` on elements that
  animate width/height/top/left on hover; animate `transform`/`opacity`/
  colors only.
- No hover animations >250ms, no bounce/spring easings, no animated
  box-shadow, no motion on scroll-linked content except the existing
  `--scroll-p` hairline and `--sky-fade`.
- Never animate during drag-resize (resize handles stay `250ms linear
  background-color` on color only).
- No new keyframes/loops without a reduced-motion guard.

### 5.3 Reduced motion

- Rule: **every** animation or transition beyond an instant color change
  must be disabled or reduced under `prefers-reduced-motion`.
- Implementation: wrap Tailwind animations in `motion-safe:`
  (`motion-safe:animate-pulse`, `motion-safe:animate-spin`), and add
  `motion-reduce:transition-none motion-reduce:hover:transform-none` on
  transform hovers (the home card at `home-page.tsx` is the reference).
- CSS keyframes get an explicit
  `@media (prefers-reduced-motion: reduce) { animation: none; transition: none; }`
  block, as `skies.css` and `app-chrome.css` already do.
- State changes themselves (panel open, selection) never depend on
  animation completing.

---

## 6. Text truncation & overflow

- Single-line labels truncate: `truncate` (plus `min-w-0` on a flex parent)
  with a `title` tooltip when the full value matters (paths, names).
- Paragraph previews clamp: `line-clamp-2`.
- Horizontal scroll is forbidden inside rail panels
  (`overflow-x-hidden` on every scroll container); content adapts via
  truncation, not scrollbars.
- Mono meta rows wrap with `flex-wrap` (`.skies-hero-meta` reference).

---

## 7. Quick reference — copy-paste snippets

```tsx
// Section eyebrow (import from panel-styles.ts)
PANEL_EYEBROW
// = "text-[10px] font-mono font-medium uppercase tracking-[0.12em] text-muted-foreground"

// Panel search row (import from panel-styles.ts)
PANEL_SEARCH_ROW + PANEL_SEARCH_INPUT_ROOT + PANEL_SEARCH_INPUT + PANEL_SEARCH_ACTION

// Standard list row
"group flex items-center gap-1.5 min-h-[26px] mx-1.5 px-1.5 rounded-[3px] text-[13px] cursor-pointer select-none"
// + inactive: "text-foreground hover:bg-[var(--hover-wash)]"
// + selected: "bg-primary/[0.07] text-primary"

// Hover-revealed row action
"invisible group-hover:visible flex items-center justify-center h-6 w-6 rounded-[3px] text-muted-foreground hover:bg-[var(--hover-wash)] hover:text-foreground"

// Segmented toggle (import from panel-styles.ts)
PANEL_SEGMENTED_ITEM + (active ? PANEL_SEGMENTED_ITEM_ACTIVE : PANEL_SEGMENTED_ITEM_INACTIVE)
```
