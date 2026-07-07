/* Copyright 2024 Marimo. All rights reserved. */

import type { Config } from "vega-lite";

/**
 * Vega/vega-lite configs porting the Waked Binary figure language from
 * ryanwaked.com (see frontend/charts-plan.md): transparent charts on the
 * desk grid, hairline grids as the only chrome (no plot frame, no tick
 * marks, no domain), JetBrains Mono guides, Source Serif titles anchored
 * start, and a categorical palette led by the trace pair (sky blue,
 * copper) then gold.
 *
 * Used in place of vega-themes' stock presets at every vega-embed call
 * site, in both color modes, via `getSkiesVegaConfig`.
 */

/** Shared, mode-independent geometry (kit rules: thin marks, real gaps).
 * NO `padding` here: this config also reaches the 80×30 table-header
 * summary charts, where fixed padding consumes the whole plot area and
 * the bars vanish (vega's default 5px is fine everywhere). */
const SKIES_BASE_CONFIG = {
  background: "transparent",

  // Kit rule: grids are the chrome — no plot frame, no ticks, no domain.
  view: { stroke: null },

  // NO `bar` config here: a config-level cornerRadiusEnd silently kills
  // vega-lite's ranged bars (x/x2 binned histograms — the table-header
  // summary charts render nothing). Square corners also match the kit.
  scale: { bandPaddingInner: 0.32, bandPaddingOuter: 0.12 },


  line: { strokeWidth: 1.6, strokeCap: "round", strokeJoin: "round" },
  point: { size: 42, filled: true, opacity: 0.9 },
  area: { opacity: 0.22, line: true },
  tick: { thickness: 1.5 },
} as const;

const SKIES_AXIS_BASE = {
  domain: false,
  ticks: false,
  gridWidth: 1,
  labelFont: "JetBrains Mono",
  labelFontSize: 10.5,
  labelPadding: 8,
  labelLimit: 220,
  labelOverlap: true,
  titleFont: "JetBrains Mono",
  titleFontSize: 10,
  titleFontWeight: 500,
  titlePadding: 12,
} as const;

const SKIES_LEGEND_BASE = {
  orient: "bottom",
  direction: "horizontal",
  labelFont: "JetBrains Mono",
  labelFontSize: 10.5,
  titleFont: "JetBrains Mono",
  titleFontSize: 10,
  symbolSize: 60,
  symbolType: "square",
  padding: 12,
} as const;

const SKIES_TITLE_BASE = {
  font: "Source Serif 4",
  fontWeight: 700,
  fontSize: 15,
  subtitleFontSize: 11,
  anchor: "start",
  offset: 14,
} as const;

export const SKIES_LIGHT_VEGA_CONFIG: Config = {
  ...SKIES_BASE_CONFIG,
  // Default single-series mark color = the sky-blue data tracer (matches
  // the first categorical color below); explicit color encodings still win.
  mark: { color: "#1b7be4" },
  arc: { stroke: "#fff", strokeWidth: 1.5 },
  rule: { color: "rgba(21, 17, 42, 0.28)" },
  title: {
    ...SKIES_TITLE_BASE,
    color: "#15112a",
    subtitleColor: "#5c5668",
  },
  axis: {
    ...SKIES_AXIS_BASE,
    gridColor: "rgba(21, 17, 42, 0.045)", // = --grid-line (light)
    labelColor: "#75707f",
    titleColor: "#5c5668",
  },
  legend: {
    ...SKIES_LEGEND_BASE,
    labelColor: "#5c5668",
    titleColor: "#75707f",
  },
  range: {
    // Skies light categorical palette: sky blue and copper (the trace
    // pair) lead, then gold and inks that hold up on warm paper. Hues are
    // saturated to read vibrant (not anemic) against #faf7f7 while staying
    // dark enough to remain legible as fills — the warm-paper analogue of
    // the night palette below. Slot 4 is an intentional neutral (as in
    // dark) so 4-series charts still separate cleanly.
    category: [
      "#1b7be4", // sky blue (= --sky-blue light)
      "#d1651f", // copper (= --copper light)
      "#dca200", // gold
      "#75707f", // neutral ink
      "#1a9c43", // grass
      "#8347d9", // violet
      "#0d9aa8", // teal
      "#cf222e", // crimson
    ],
  },
} as const;

export const SKIES_DARK_VEGA_CONFIG: Config = {
  ...SKIES_BASE_CONFIG,
  mark: { color: "#5fa6ef" },
  arc: { stroke: "#15131d", strokeWidth: 1.5 },
  rule: { color: "rgba(220, 214, 232, 0.28)" },
  title: {
    ...SKIES_TITLE_BASE,
    color: "#f3f1f7",
    subtitleColor: "#bbb5c7",
  },
  axis: {
    ...SKIES_AXIS_BASE,
    gridColor: "rgba(220, 214, 232, 0.055)", // = --grid-line (dark)
    labelColor: "#8f89a3",
    titleColor: "#bbb5c7",
  },
  legend: {
    ...SKIES_LEGEND_BASE,
    labelColor: "#bbb5c7",
    titleColor: "#8f89a3",
  },
  range: {
    // Skies night categorical palette: the moonlit trace pair leads, then
    // gold and hues tuned to the #15131d canvas.
    category: [
      "#5fa6ef",
      "#d98552",
      "#e8c44e",
      "#8f89a3",
      "#3fb950",
      "#b79ce8",
      "#58c1cc",
      "#f0564b",
    ],
  },
} as const;

/** Resolve the Skies vega config for the active color mode. */
export function getSkiesVegaConfig(theme: "light" | "dark"): Config {
  return theme === "dark" ? SKIES_DARK_VEGA_CONFIG : SKIES_LIGHT_VEGA_CONFIG;
}
