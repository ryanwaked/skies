/* Copyright 2026 Marimo. All rights reserved. */

/**
 * Deterministic per-notebook visual identity, seeded entirely by a notebook's
 * path. Used by the home-page mini-preview to give every notebook a stable,
 * recognizable "paper" tint even before (or without) its content preview —
 * so a notebook looks the same every time you open the home page.
 */

/** Deterministic 32-bit FNV-1a hash of a string. */
export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Six muted Skies tints. Each is applied as a small wash OVER `--card`, so the
 * paper stays WCAG-AA in both themes without any dynamic hsl()/matchMedia
 * machinery — the tints are snapped to curated brand hues, never a raw hue.
 */
const TINTS = [
  "var(--sky-blue)",
  "var(--copper)",
  "var(--gold)",
  "#7c5cbf", // dusk violet — the one non-token brand accent
  "var(--success)",
  "var(--foreground)",
] as const;

export interface NotebookTint {
  /** `--nb-paper`: the tinted panel background (a light-dark() color-mix). */
  paper: string;
  /** `--nb-edge`: a stronger wash of the same tint for gutter bars / edges. */
  edge: string;
  /** Which of the six tints this path maps to (0–5). */
  bucket: number;
}

/** Map a notebook path to a stable tinted-paper background + edge color. */
export function tintForPath(path: string): NotebookTint {
  const bucket = hashString(path) % TINTS.length;
  const tint = TINTS[bucket];
  // Bump the dark-mode mix higher so identity survives on the dark canvas.
  const paper = `light-dark(color-mix(in srgb, var(--card) 92%, ${tint} 8%), color-mix(in srgb, var(--card) 88%, ${tint} 12%))`;
  const edge = `color-mix(in srgb, ${tint} 40%, transparent)`;
  return { paper, edge, bucket };
}
