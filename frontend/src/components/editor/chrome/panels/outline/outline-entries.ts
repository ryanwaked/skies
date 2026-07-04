/* Copyright 2026 Marimo. All rights reserved. */

import { atom } from "jotai";
import { notebookAtom } from "@/core/cells/cells";
import type { CellId } from "@/core/cells/ids";
import { isInternalCellName } from "@/core/cells/names";
import type { OutlineItem } from "@/core/cells/outline";
import { languageAdapterFromCode } from "@/core/codemirror/language/extension";
import type { LanguageAdapterType } from "@/core/codemirror/language/types";

export interface HeadingEntry {
  kind: "heading";
  item: OutlineItem;
}

export interface CellEntry {
  kind: "cell";
  cellId: CellId;
  /** Language of the cell, detected from its code. */
  language: LanguageAdapterType;
  /** User-given name, or `undefined` when the cell is unnamed. */
  name: string | undefined;
  /** First non-empty line of code, shown for unnamed cells. */
  preview: string;
  /**
   * Indent level of the entry: one level under the last seen heading,
   * mirroring heading levels (1 = top-level).
   */
  indentLevel: number;
}

export type OutlineEntry = HeadingEntry | CellEntry;

/** Deepest indent we render, matching the heading rows. */
const MAX_INDENT_LEVEL = 4;
const MAX_PREVIEW_LENGTH = 80;

function firstNonEmptyLine(code: string): string {
  for (const line of code.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) {
      return trimmed.length > MAX_PREVIEW_LENGTH
        ? `${trimmed.slice(0, MAX_PREVIEW_LENGTH)}…`
        : trimmed;
    }
  }
  return "";
}

/**
 * Outline entries for the sidebar panel: markdown headings interleaved with
 * cell-level entries, in document order.
 *
 * Cells whose output produced headings are represented by those heading
 * entries and do not get a duplicate cell entry. Heading order matches
 * `notebookOutline`, so occurrence counting stays in sync with
 * `useActiveOutline`.
 */
export const outlineEntriesAtom = atom<OutlineEntry[]>((get) => {
  const { cellIds, cellData, cellRuntime } = get(notebookAtom);
  const entries: OutlineEntry[] = [];
  let lastHeadingLevel = 0;

  for (const cellId of cellIds.inOrderIds) {
    const outlineItems = cellRuntime[cellId]?.outline?.items;
    if (outlineItems && outlineItems.length > 0) {
      // The heading entries represent this cell; no duplicate cell entry.
      for (const item of outlineItems) {
        entries.push({ kind: "heading", item });
        lastHeadingLevel = item.level;
      }
      continue;
    }

    const data = cellData[cellId];
    const code = data?.code ?? "";
    const name = data?.name;
    entries.push({
      kind: "cell",
      cellId,
      language: languageAdapterFromCode(code.trim()).type,
      name: isInternalCellName(name) ? undefined : name,
      preview: firstNonEmptyLine(code),
      indentLevel: Math.min(lastHeadingLevel + 1, MAX_INDENT_LEVEL),
    });
  }

  return entries;
});
