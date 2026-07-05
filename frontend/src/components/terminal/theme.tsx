/* Copyright 2026 Marimo. All rights reserved. */
import type { ResolvedTheme } from "@/theme/useTheme";

// Terminal theme configuration — the Skies inks: night terminal on the
// #15131d canvas, paper terminal on white; ANSI hues tuned to the trace
// palette (sky blue, copper, gold) plus the semantic status tones.
export function createTerminalTheme(theme: ResolvedTheme) {
  const baseTheme = {
    cursor: "#ffffff",
    cursorAccent: "#000000",
  };

  return theme === "dark"
    ? {
        ...baseTheme,
        background: "#15131d",
        foreground: "#e9e6f2",
        black: "#15131d",
        red: "#f0564b",
        green: "#3fb950",
        yellow: "#e8c44e",
        blue: "#5fa6ef",
        magenta: "#b79ce8",
        cyan: "#58c1cc",
        white: "#e9e6f2",
        brightBlack: "#847e92",
        brightRed: "#f57c73",
        brightGreen: "#66cc74",
        brightYellow: "#f0d478",
        brightBlue: "#8fc0f4",
        brightMagenta: "#ccb6f0",
        brightCyan: "#7fd2db",
        brightWhite: "#ffffff",
        selection: "rgba(95, 166, 239, 0.25)",
      }
    : {
        ...baseTheme,
        background: "#ffffff",
        foreground: "#15112a",
        cursor: "#15112a",
        black: "#15112a",
        red: "#cf222e",
        green: "#1f883d",
        yellow: "#9a6700",
        blue: "#1b7be4",
        magenta: "#7c5cbf",
        cyan: "#0e7f8a",
        white: "#f2eded",
        brightBlack: "#75707f",
        brightRed: "#f0564b",
        brightGreen: "#3fb950",
        brightYellow: "#c2980f",
        brightBlue: "#5fa6ef",
        brightMagenta: "#9d7fd8",
        brightCyan: "#2ba4b1",
        brightWhite: "#ffffff",
        selection: "rgba(27, 123, 228, 0.18)",
      };
}
