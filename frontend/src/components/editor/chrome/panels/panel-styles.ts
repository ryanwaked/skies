/* Copyright 2026 Marimo. All rights reserved. */

/**
 * Shared rail-panel chrome, matching the Data browser (datasources) so every
 * panel reads as one system: a bottom-bordered header row holding a flat,
 * rounded, bordered search "pill", with square icon actions beside it. Keyboard
 * focus is the global inset sky-blue ring (see skies.css `:focus-visible`).
 *
 * Consume these instead of re-typing the classes per panel so the rail stays
 * consistent as panels change.
 */

/** The header row that wraps a panel's search field + its actions. */
export const PANEL_SEARCH_ROW =
  "flex items-center gap-1 w-full px-2 py-1.5 border-b shrink-0";

/** Wrapper (rootClassName) for the search input itself — the bordered pill. */
export const PANEL_SEARCH_INPUT_ROOT =
  "flex-1 h-7 px-2.5 rounded-[3px] border bg-card";

/** The <input> inside the pill. */
export const PANEL_SEARCH_INPUT =
  "h-full py-0 text-[13px] placeholder:text-muted-foreground";

/** A square icon button sitting beside the search pill (add, export, …). */
export const PANEL_SEARCH_ACTION =
  "flex items-center justify-center h-7 w-7 shrink-0 rounded-[3px] text-muted-foreground hover:text-foreground hover:bg-[var(--hover-wash)] disabled:opacity-40";
