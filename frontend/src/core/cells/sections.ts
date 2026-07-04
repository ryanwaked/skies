/* Copyright 2026 Marimo. All rights reserved. */

import { selectAtom } from "jotai/utils";
import { canCollapseOutline, findCollapseRange } from "@/core/dom/outline";
import { type NotebookState, notebookAtom } from "./cells";
import type { CellId } from "./ids";
import type { Outline } from "./outline";

/**
 * Hex-style section info for a cell, derived from markdown headings.
 *
 * A cell whose output contains an H1–H3 heading (the same cells marimo's
 * collapse feature treats as anchors, see `canCollapseOutline`) is a
 * "section head"; the cells beneath it — until the next heading of the
 * same or higher level — belong to its section.
 */
export interface CellSectionInfo {
  /** True when this cell's output starts a section (H1–H3 heading). */
  isSectionHead: boolean;
  /** True when this cell sits inside a section (below a heading cell). */
  inSection: boolean;
  /**
   * For section heads: id of the last top-level cell in the section
   * (inclusive; equals the head itself for empty sections). `null` for
   * non-head cells.
   */
  lastCellId: CellId | null;
}

const NOT_IN_SECTION: CellSectionInfo = {
  isSectionHead: false,
  inSection: false,
  lastCellId: null,
};

/**
 * Walks each column's top-level cells in document order — the same walk
 * (and the same `findCollapseRange` helper) the `collapseCell` action uses —
 * so section grouping always matches what the collapse chevron folds.
 */
function computeSections(
  notebook: NotebookState,
): Map<CellId, CellSectionInfo> {
  const { cellIds, cellRuntime } = notebook;
  const sections = new Map<CellId, CellSectionInfo>();

  for (const column of cellIds.getColumns()) {
    const topLevelIds = column.topLevelIds;
    const outlines: (Outline | null)[] = topLevelIds.map(
      (id) => cellRuntime[id]?.outline ?? null,
    );

    // Stack of currently-open heading levels; non-empty means the cell
    // being visited is nested under some heading.
    const openLevels: number[] = [];

    topLevelIds.forEach((cellId, index) => {
      const outline = outlines[index];
      if (!canCollapseOutline(outline) || outline == null) {
        sections.set(cellId, {
          isSectionHead: false,
          inSection: openLevels.length > 0,
          lastCellId: null,
        });
        return;
      }

      // A heading closes every open section at the same or deeper level.
      const level = Math.min(...outline.items.map((item) => item.level));
      while (
        openLevels.length > 0 &&
        openLevels[openLevels.length - 1] >= level
      ) {
        openLevels.pop();
      }

      const range = findCollapseRange(index, outlines);
      sections.set(cellId, {
        isSectionHead: true,
        inSection: openLevels.length > 0,
        lastCellId: range ? topLevelIds[range[1]] : null,
      });
      openLevels.push(level);
    });
  }

  return sections;
}

function sectionsEqual(
  a: Map<CellId, CellSectionInfo>,
  b: Map<CellId, CellSectionInfo>,
): boolean {
  if (a === b) {
    return true;
  }
  if (a.size !== b.size) {
    return false;
  }
  for (const [cellId, info] of a) {
    const other = b.get(cellId);
    if (
      other === undefined ||
      other.isSectionHead !== info.isSectionHead ||
      other.inSection !== info.inSection ||
      other.lastCellId !== info.lastCellId
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Section info for every top-level cell, keyed by cell id.
 *
 * Equality-checked so cell rendering doesn't churn on unrelated notebook
 * updates (e.g. console output).
 */
export const cellSectionsAtom = selectAtom(
  notebookAtom,
  computeSections,
  sectionsEqual,
);

/** Section info for a single cell. */
export function getSectionInfo(
  sections: Map<CellId, CellSectionInfo>,
  cellId: CellId,
): CellSectionInfo {
  return sections.get(cellId) ?? NOT_IN_SECTION;
}
