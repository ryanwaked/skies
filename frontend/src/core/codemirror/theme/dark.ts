/* Copyright 2026 Marimo. All rights reserved. */

import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { createTheme } from "thememirror";

export const darkTheme = [
  createTheme({
    variant: "dark",
    settings: {
      background: "var(--cm-background)",
      foreground: "#e4e6ec",
      caret: "#669eff",
      selection: "#3f4257",
      lineHighlight: "rgb(255 255 255 / 3%)",
      gutterBackground: "var(--color-background)",
      gutterForeground: "color-mix(in srgb, var(--muted-foreground) 60%, transparent)",
    },
    styles: [
      { tag: t.comment, color: "#b1b6c4" },
      { tag: t.variableName, color: "#e4e6ec" },
      { tag: [t.string, t.special(t.brace)], color: "#ed6f73" },
      { tag: t.number, color: "#2ee6d6" },
      { tag: t.bool, color: "#5987e0" },
      { tag: t.null, color: "#5987e0" },
      { tag: t.keyword, color: "#669eff", fontWeight: 500 },
      { tag: t.className, color: "#7cacf8" },
      { tag: t.definition(t.typeName), color: "#7cacf8" },
      { tag: t.typeName, color: "#2ee6d6" },
      { tag: t.angleBracket, color: "#e4e6ec" },
      { tag: t.tagName, color: "#ed6f73" },
      { tag: t.attributeName, color: "#7cacf8" },
      { tag: t.operator, color: "#aeb4c2", fontWeight: 500 },
      { tag: [t.function(t.variableName)], color: "#7cacf8" },
      { tag: [t.propertyName], color: "#84a6e8" },
    ],
  }),
  EditorView.theme({
    ".mo-cm-reactive-reference": {
      fontWeight: "400",
      color: "#84a6e8",
      borderBottom: "2px solid rgb(132 166 232 / 40%)",
    },
    ".mo-cm-reactive-reference-hover": {
      cursor: "pointer",
      borderBottomWidth: "3px",
      borderBottomColor: "#84a6e8",
    },
  }),
];
