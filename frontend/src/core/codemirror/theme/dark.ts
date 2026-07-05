/* Copyright 2026 Marimo. All rights reserved. */

import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { createTheme } from "thememirror";

/* Skies night syntax: moonlit ink on the #211d2c paper panel. Keywords and
 * callables take the sky blues, strings the copper editorial voice, numbers
 * the gold — the same trace inks the site draws its charts with. */
export const darkTheme = [
  createTheme({
    variant: "dark",
    settings: {
      background: "var(--cm-background)",
      foreground: "#e9e6f2",
      caret: "#5fa6ef",
      selection: "rgb(95 166 239 / 24%)",
      lineHighlight: "rgb(220 214 232 / 4%)",
      gutterBackground: "var(--color-background)",
      gutterForeground: "color-mix(in srgb, var(--muted-foreground) 60%, transparent)",
    },
    styles: [
      { tag: t.comment, color: "#847e92" },
      { tag: t.variableName, color: "#e9e6f2" },
      { tag: [t.string, t.special(t.brace)], color: "#d98552" },
      { tag: t.number, color: "#e8c44e" },
      { tag: t.bool, color: "#79aef0" },
      { tag: t.null, color: "#79aef0" },
      { tag: t.keyword, color: "#5fa6ef", fontWeight: 500 },
      { tag: t.className, color: "#9ec7f3" },
      { tag: t.definition(t.typeName), color: "#9ec7f3" },
      { tag: t.typeName, color: "#6fc7b9" },
      { tag: t.angleBracket, color: "#e9e6f2" },
      { tag: t.tagName, color: "#d98552" },
      { tag: t.attributeName, color: "#9ec7f3" },
      { tag: t.operator, color: "#bbb5c7", fontWeight: 500 },
      { tag: [t.function(t.variableName)], color: "#9ec7f3" },
      { tag: [t.propertyName], color: "#8fb8ec" },
    ],
  }),
  EditorView.theme({
    ".mo-cm-reactive-reference": {
      fontWeight: "400",
      color: "#8fb8ec",
      borderBottom: "2px solid rgb(143 184 236 / 40%)",
    },
    ".mo-cm-reactive-reference-hover": {
      cursor: "pointer",
      borderBottomWidth: "3px",
      borderBottomColor: "#8fb8ec",
    },
  }),
];
