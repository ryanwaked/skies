/* Copyright 2026 Marimo. All rights reserved. */

import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { createTheme } from "thememirror";

/* Skies paper syntax: deep-indigo ink on the white paper panel. Keywords
 * take the deep blue, callables the sky blue, strings the copper editorial
 * voice, numbers the amber-gold ink. */
export const lightTheme = [
  createTheme({
    variant: "light",
    settings: {
      background: "#ffffff",
      foreground: "#15112a",
      caret: "#1b7be4",
      selection: "rgb(27 123 228 / 15%)",
      lineHighlight: "rgb(27 123 228 / 4%)",
      gutterBackground: "var(--color-background)",
      gutterForeground: "var(--gray-10)",
    },
    styles: [
      { tag: t.comment, color: "var(--cm-comment)" },
      { tag: t.variableName, color: "#15112a" },
      { tag: [t.string, t.special(t.brace)], color: "#c85c1e" },
      { tag: t.number, color: "#b8790a" },
      { tag: t.bool, color: "#1565cc" },
      { tag: t.null, color: "#1565cc" },
      { tag: t.keyword, color: "#1565cc", fontWeight: 500 },
      { tag: t.className, color: "#1b7be4" },
      { tag: t.definition(t.typeName), color: "#1b7be4" },
      { tag: t.typeName, color: "#0d8f78" },
      { tag: t.angleBracket, color: "#15112a" },
      { tag: t.tagName, color: "#c85c1e" },
      { tag: t.attributeName, color: "#1b7be4" },
      { tag: t.operator, color: "#5c5668", fontWeight: 500 },
      { tag: [t.function(t.variableName)], color: "#1b7be4" },
      { tag: [t.propertyName], color: "#1565cc" },
    ],
  }),
  EditorView.theme({
    ".mo-cm-reactive-reference": {
      fontWeight: "400",
      color: "#1565cc",
      borderBottom: "2px solid rgb(27 123 228 / 40%)",
    },
    ".mo-cm-reactive-reference-hover": {
      cursor: "pointer",
      borderBottomWidth: "3px",
    },
  }),
];
