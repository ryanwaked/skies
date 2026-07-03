/* Copyright 2024 Marimo. All rights reserved. */

import type { Config } from "vega-lite";

/**
 * Dark-mode vega/vega-lite config matching the Hex.tech design language:
 * charts sit transparent on the #1a1a23 canvas with IBM Plex Sans guides,
 * #e4e6ec titles, #b1b6c4 labels, and #353548 grid/domain lines.
 *
 * Used in place of vega-themes' stock "dark" preset (a #333 card with
 * pure-white labels) at every vega-embed call site.
 */
export const HEX_DARK_VEGA_CONFIG: Config = {
  background: "transparent",
  view: { stroke: "#353548" },
  // Default single-series mark color = the brand blush pink (matches the
  // first categorical color below); explicit color encodings still win.
  mark: { color: "#f5c0c0" },
  title: {
    color: "#e4e6ec",
    subtitleColor: "#b1b6c4",
    font: "IBM Plex Sans",
    fontWeight: 600,
  },
  axis: {
    domainColor: "#353548",
    gridColor: "#353548",
    tickColor: "#353548",
    labelColor: "#b1b6c4",
    titleColor: "#e4e6ec",
    labelFont: "IBM Plex Sans",
    titleFont: "IBM Plex Sans",
  },
  legend: {
    labelColor: "#b1b6c4",
    titleColor: "#e4e6ec",
    labelFont: "IBM Plex Sans",
    titleFont: "IBM Plex Sans",
  },
  range: {
    // Hex dark categorical palette: blush-pink brand first, then muted hues
    // that hold up on the #1a1a23 canvas.
    category: [
      "#f5c0c0",
      "#84a6e8",
      "#43d59d",
      "#ffc940",
      "#c792ea",
      "#6ecfd9",
      "#ed6f73",
      "#b1b6c4",
    ],
  },
} as const;
