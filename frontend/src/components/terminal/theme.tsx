/* Copyright 2026 Marimo. All rights reserved. */
import type { ResolvedTheme } from "@/theme/useTheme";

// Terminal theme configuration
export function createTerminalTheme(theme: ResolvedTheme) {
  const baseTheme = {
    cursor: "#ffffff",
    cursorAccent: "#000000",
  };

  return theme === "dark"
    ? {
        ...baseTheme,
        background: "#17171F",
        foreground: "#e4e6ec",
        black: "#17171F",
        red: "#ed6f73",
        green: "#43d59d",
        yellow: "#ffc940",
        blue: "#84a6e8",
        magenta: "#c084fc",
        cyan: "#2ee6d6",
        white: "#e4e6ec",
        brightBlack: "#b1b6c4",
        brightRed: "#f28d90",
        brightGreen: "#6ee0b3",
        brightYellow: "#ffd66b",
        brightBlue: "#a3bdee",
        brightMagenta: "#d3a8fd",
        brightCyan: "#5cecdf",
        brightWhite: "#ffffff",
        selection: "rgba(245, 192, 192, 0.25)",
      }
    : {
        ...baseTheme,
        background: "#ffffff", // white
        foreground: "#0f172a", // slate-900
        cursor: "#0f172a",
        black: "#0f172a",
        red: "#dc2626",
        green: "#16a34a",
        yellow: "#ca8a04",
        blue: "#2563eb",
        magenta: "#9333ea",
        cyan: "#0891b2",
        white: "#e2e8f0",
        brightBlack: "#64748b",
        brightRed: "#ef4444",
        brightGreen: "#22c55e",
        brightYellow: "#eab308",
        brightBlue: "#3b82f6",
        brightMagenta: "#a855f7",
        brightCyan: "#06b6d4",
        brightWhite: "#ffffff",
        selection: "rgba(71, 85, 105, 0.2)", // slate-600 with opacity
      };
}
