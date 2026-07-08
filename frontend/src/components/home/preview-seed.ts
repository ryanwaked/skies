/* Copyright 2026 Marimo. All rights reserved. */

/**
 * Visual identity for the home-page mini-preview "paper".
 *
 * The preview keeps its paper design (the blueprint grid in `.skies-nb-preview`
 * plus the code/markdown silhouettes), but every notebook now uses the SAME
 * default paper color instead of a per-notebook tint — the rotating
 * blue/gold/violet/etc. washes were removed on request.
 */

export interface NotebookTint {
  /** `--nb-paper`: the panel background (the default card paper). */
  paper: string;
  /** `--nb-edge`: a neutral wash for gutter bars / glyph edges. */
  edge: string;
}

/**
 * The single default paper + edge used by every notebook preview. `edge` is a
 * theme-neutral wash of the ink so the tiny gutter bars and output glyphs stay
 * legible on both the light and dark card surfaces.
 */
export function tintForPath(_path: string): NotebookTint {
  return {
    paper: "var(--card)",
    edge: "color-mix(in srgb, var(--foreground) 18%, transparent)",
  };
}
