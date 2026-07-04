/* Copyright 2026 Marimo. All rights reserved. */
import { describe, expect, it } from "vitest";
import {
  addPathToCollection,
  assignedPaths,
  collectionContainingPath,
  type CollectionsState,
  createCollection,
  deleteCollection,
  initialCollectionsState,
  removePathFromCollections,
  renameCollection,
  toggleCollectionCollapsed,
} from "../collections";

function stateWith(
  ...collections: Array<{ name: string; filePaths?: string[] }>
): CollectionsState {
  let state = initialCollectionsState;
  for (const { name, filePaths = [] } of collections) {
    const created = createCollection(state, name);
    state = created.state;
    for (const path of filePaths) {
      state = addPathToCollection(state, { id: created.id, path });
    }
  }
  return state;
}

describe("createCollection", () => {
  it("appends a new empty collection and returns its id", () => {
    const { state, id } = createCollection(initialCollectionsState, "Demos");
    expect(state.collections).toEqual([{ id, name: "Demos", filePaths: [] }]);
    // Does not mutate the input state
    expect(initialCollectionsState.collections).toEqual([]);
  });

  it("generates unique ids", () => {
    const first = createCollection(initialCollectionsState, "A");
    const second = createCollection(first.state, "B");
    expect(first.id).not.toEqual(second.id);
  });
});

describe("renameCollection", () => {
  it("renames only the target collection", () => {
    const state = stateWith({ name: "A" }, { name: "B" });
    const [a, b] = state.collections;
    const next = renameCollection(state, { id: a.id, name: "Renamed" });
    expect(next.collections.map((c) => c.name)).toEqual(["Renamed", "B"]);
    expect(next.collections[1].id).toEqual(b.id);
  });
});

describe("deleteCollection", () => {
  it("removes the collection so its files become unassigned", () => {
    const state = stateWith(
      { name: "A", filePaths: ["nb1.py"] },
      { name: "B", filePaths: ["nb2.py"] },
    );
    const next = deleteCollection(state, state.collections[0].id);
    expect(next.collections.map((c) => c.name)).toEqual(["B"]);
    expect(assignedPaths(next)).toEqual(new Set(["nb2.py"]));
  });
});

describe("addPathToCollection", () => {
  it("assigns a path to the collection", () => {
    const state = stateWith({ name: "A" });
    const next = addPathToCollection(state, {
      id: state.collections[0].id,
      path: "nb.py",
    });
    expect(next.collections[0].filePaths).toEqual(["nb.py"]);
  });

  it("moves a path between collections (single membership)", () => {
    const state = stateWith({ name: "A", filePaths: ["nb.py"] }, { name: "B" });
    const next = addPathToCollection(state, {
      id: state.collections[1].id,
      path: "nb.py",
    });
    expect(next.collections[0].filePaths).toEqual([]);
    expect(next.collections[1].filePaths).toEqual(["nb.py"]);
  });

  it("does not duplicate an already-assigned path", () => {
    const state = stateWith({ name: "A", filePaths: ["nb.py"] });
    const next = addPathToCollection(state, {
      id: state.collections[0].id,
      path: "nb.py",
    });
    expect(next.collections[0].filePaths).toEqual(["nb.py"]);
  });
});

describe("removePathFromCollections", () => {
  it("unassigns the path from whichever collection has it", () => {
    const state = stateWith(
      { name: "A", filePaths: ["nb1.py", "nb2.py"] },
      { name: "B", filePaths: ["nb3.py"] },
    );
    const next = removePathFromCollections(state, "nb2.py");
    expect(next.collections[0].filePaths).toEqual(["nb1.py"]);
    expect(next.collections[1].filePaths).toEqual(["nb3.py"]);
  });
});

describe("toggleCollectionCollapsed", () => {
  it("toggles collapsed state on and off", () => {
    const state = stateWith({ name: "A" });
    const id = state.collections[0].id;
    const collapsed = toggleCollectionCollapsed(state, id);
    expect(collapsed.collections[0].collapsed).toBe(true);
    const expanded = toggleCollectionCollapsed(collapsed, id);
    expect(expanded.collections[0].collapsed).toBe(false);
  });
});

describe("collectionContainingPath", () => {
  it("finds the owning collection or returns undefined", () => {
    const state = stateWith({ name: "A", filePaths: ["nb.py"] });
    expect(collectionContainingPath(state, "nb.py")?.name).toEqual("A");
    expect(collectionContainingPath(state, "other.py")).toBeUndefined();
  });
});

describe("assignedPaths", () => {
  it("collects paths across all collections", () => {
    const state = stateWith(
      { name: "A", filePaths: ["nb1.py"] },
      { name: "B", filePaths: ["nb2.py", "nb3.py"] },
    );
    expect(assignedPaths(state)).toEqual(
      new Set(["nb1.py", "nb2.py", "nb3.py"]),
    );
  });

  it("is empty for the initial state", () => {
    expect(assignedPaths(initialCollectionsState)).toEqual(new Set());
  });
});
