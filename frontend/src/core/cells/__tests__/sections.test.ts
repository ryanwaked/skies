/* Copyright 2026 Marimo. All rights reserved. */

import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { MockNotebook } from "@/__mocks__/notebook";
import { notebookAtom } from "@/core/cells/cells";
import { CellId } from "@/core/cells/ids";
import type { Outline } from "@/core/cells/outline";
import { cellSectionsAtom, getSectionInfo } from "@/core/cells/sections";

function heading(level: number, name = `h${level}`): Outline {
  return { items: [{ name, level, by: { id: name } }] };
}

function setupStore(outlines: (Outline | null)[]) {
  const cellIds = Array.from({ length: outlines.length }, () =>
    CellId.create(),
  );
  const state = MockNotebook.notebookState({
    cellData: Object.fromEntries(cellIds.map((id) => [id, {}])),
    cellRuntime: Object.fromEntries(
      cellIds.map((id, i) => [id, { outline: outlines[i] }]),
    ),
  });
  const store = createStore();
  store.set(notebookAtom, state);
  return { store, cellIds };
}

describe("cellSectionsAtom", () => {
  it("returns no sections when there are no headings", () => {
    const { store, cellIds } = setupStore([null, null]);
    const sections = store.get(cellSectionsAtom);
    for (const cellId of cellIds) {
      expect(getSectionInfo(sections, cellId)).toEqual({
        isSectionHead: false,
        inSection: false,
        lastCellId: null,
      });
    }
  });

  it("groups cells under a heading until the next same-or-higher heading", () => {
    // h1, py, py, h2, py, h1, py
    const { store, cellIds } = setupStore([
      heading(1),
      null,
      null,
      heading(2),
      null,
      heading(1),
      null,
    ]);
    const [h1, py1, py2, h2, py3, h1b, py4] = cellIds;
    const sections = store.get(cellSectionsAtom);

    // First H1 section spans everything up to (not including) the second H1.
    expect(getSectionInfo(sections, h1)).toEqual({
      isSectionHead: true,
      inSection: false,
      lastCellId: py3,
    });
    // Nested H2 is both a member of the H1 section and a head of its own.
    expect(getSectionInfo(sections, h2)).toEqual({
      isSectionHead: true,
      inSection: true,
      lastCellId: py3,
    });
    expect(getSectionInfo(sections, h1b)).toEqual({
      isSectionHead: true,
      inSection: false,
      lastCellId: py4,
    });
    // Plain cells are members but never heads.
    for (const member of [py1, py2, py3, py4]) {
      expect(getSectionInfo(sections, member)).toEqual({
        isSectionHead: false,
        inSection: true,
        lastCellId: null,
      });
    }
  });

  it("treats an empty section's head as its own last cell", () => {
    const { store, cellIds } = setupStore([null, heading(2)]);
    const [py, h2] = cellIds;
    expect(getSectionInfo(store.get(cellSectionsAtom), h2)).toEqual({
      isSectionHead: true,
      inSection: false,
      lastCellId: h2,
    });
    expect(getSectionInfo(store.get(cellSectionsAtom), py).inSection).toBe(
      false,
    );
  });

  it("ignores deep headings (H4+), matching collapse behavior", () => {
    // h2, h4, py — the H4 cell is a plain member, not a section head.
    const { store, cellIds } = setupStore([heading(2), heading(4), null]);
    const [h2, h4, py] = cellIds;
    const sections = store.get(cellSectionsAtom);
    expect(getSectionInfo(sections, h2)).toEqual({
      isSectionHead: true,
      inSection: false,
      lastCellId: py,
    });
    expect(getSectionInfo(sections, h4)).toEqual({
      isSectionHead: false,
      inSection: true,
      lastCellId: null,
    });
  });
});
