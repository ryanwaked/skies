/* Copyright 2024 Marimo. All rights reserved. */

import type { Config } from "vega-lite";

/**
 * Vega/vega-lite configs matching the Skies design language from
 * ryanwaked.com: charts sit transparent on the desk grid with JetBrains
 * Mono guides, Source Serif titles, hairline ink grid lines, and a
 * categorical palette led by the trace pair (sky blue, copper) and gold.
 *
 * Used in place of vega-themes' stock presets at every vega-embed call
 * site, in both color modes, via `getSkiesVegaConfig`.
 */
export const SKIES_LIGHT_VEGA_CONFIG: Config = {
  background: "transparent",
  view: { stroke: "rgba(21, 17, 42, 0.12)" },
  // Default single-series mark color = the sky-blue data tracer (matches
  // the first categorical color below); explicit color encodings still win.
  mark: { color: "#1b7be4" },
  title: {
    color: "#15112a",
    subtitleColor: "#5c5668",
    font: "Source Serif 4",
    fontWeight: 700,
  },
  axis: {
    domainColor: "rgba(21, 17, 42, 0.12)",
    gridColor: "rgba(21, 17, 42, 0.08)",
    tickColor: "rgba(21, 17, 42, 0.12)",
    labelColor: "#75707f",
    titleColor: "#5c5668",
    labelFont: "JetBrains Mono",
    titleFont: "JetBrains Mono",
    labelFontSize: 10.5,
  },
  legend: {
    labelColor: "#5c5668",
    titleColor: "#75707f",
    labelFont: "JetBrains Mono",
    titleFont: "JetBrains Mono",
  },
  range: {
    // Skies light categorical palette: sky blue and copper (the trace
    // pair) lead, then gold and inks that hold up on warm paper.
    category: [
      "#1b7be4",
      "#a8542c",
      "#c2980f",
      "#1f883d",
      "#7c5cbf",
      "#0e7f8a",
      "#cf222e",
      "#75707f",
    ],
  },
} as const;

export const SKIES_DARK_VEGA_CONFIG: Config = {
  background: "transparent",
  view: { stroke: "rgba(220, 214, 232, 0.14)" },
  mark: { color: "#5fa6ef" },
  title: {
    color: "#f3f1f7",
    subtitleColor: "#bbb5c7",
    font: "Source Serif 4",
    fontWeight: 700,
  },
  axis: {
    domainColor: "rgba(220, 214, 232, 0.14)",
    gridColor: "rgba(220, 214, 232, 0.09)",
    tickColor: "rgba(220, 214, 232, 0.14)",
    labelColor: "#847e92",
    titleColor: "#bbb5c7",
    labelFont: "JetBrains Mono",
    titleFont: "JetBrains Mono",
    labelFontSize: 10.5,
  },
  legend: {
    labelColor: "#bbb5c7",
    titleColor: "#847e92",
    labelFont: "JetBrains Mono",
    titleFont: "JetBrains Mono",
  },
  range: {
    // Skies night categorical palette: the moonlit trace pair leads, then
    // hues tuned to the #15131d canvas.
    category: [
      "#5fa6ef",
      "#d98552",
      "#e8c44e",
      "#3fb950",
      "#b79ce8",
      "#58c1cc",
      "#f0564b",
      "#847e92",
    ],
  },
} as const;

/** Resolve the Skies vega config for the active color mode. */
export function getSkiesVegaConfig(theme: "light" | "dark"): Config {
  return theme === "dark" ? SKIES_DARK_VEGA_CONFIG : SKIES_LIGHT_VEGA_CONFIG;
}
