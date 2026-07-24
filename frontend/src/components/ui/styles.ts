/* Copyright 2026 Marimo. All rights reserved. */

import { cn } from "@/utils/cn";

/**
 * Shared style primitives for the design system.
 *
 * @see {@link https://www.radix-ui.com/primitives/docs/guides/styling}
 */

/**
 * The Skies focus ring: a hairline sky-blue ring with a coordinating border
 * swap, no offset. Flat to match the design language (hairline borders, no
 * floating rings). Use on every focusable control via `cn(focusRing, ...)`.
 *
 * The ring is drawn `inset` (inside the border-box) rather than outset so it
 * can never be clipped by an `overflow-hidden`/`overflow-auto` ancestor — the
 * cause of the "focus highlight top border gets cut off" bug on inputs that
 * sit flush against the top of a scrolling panel (rail search fields, etc.).
 *
 * Pair with `outline-hidden` (Tailwind v4's `outline: none` + reset) so the
 * default UA outline is replaced rather than doubled.
 */
export const focusRing =
  "focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring focus-visible:border-primary";

/**
 * Slider track + range + thumb styling, token-driven so it adapts to the
 * theme (light/dark) without per-mode overrides. Shared by `Slider` and
 * `RangeSlider` to keep the two visually identical.
 */
export const sliderTrack =
  "relative grow overflow-hidden rounded-full bg-muted";
export const sliderRange = "absolute bg-primary";
export const sliderThumb = cn(
  "block h-4 w-4 rounded-full bg-background border border-primary",
  "hover:bg-accent transition-colors",
  // Replace Radix's default focus with the design-system ring.
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
  "data-disabled:pointer-events-none data-disabled:opacity-50",
);

/**
 * Shared title class for elevated surfaces (Dialog, AlertDialog, Sheet) —
 * the app-scale heading: base size, semibold, gently tight tracking. The
 * `typography.tsx` H1–H4 are sized for marketing/docs and don't fit panels.
 */
export const overlayTitle = "text-base font-semibold tracking-[-0.04em]";

/**
 * Shared scrim class for elevated surfaces (Dialog, AlertDialog, Sheet) —
 * a translucent background wash with a soft blur, with matching in/out
 * fades. Replaces the three slightly-different scrims the overlays used.
 */
export const overlayScrim =
  "fixed inset-0 z-modal bg-background/80 backdrop-blur-xs " +
  "data-[state=open]:animate-in data-[state=open]:fade-in " +
  "data-[state=closed]:animate-out data-[state=closed]:fade-out";
