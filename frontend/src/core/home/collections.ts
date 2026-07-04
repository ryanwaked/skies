/* Copyright 2026 Marimo. All rights reserved. */

import { atomWithStorage } from "jotai/utils";
import { jotaiJsonStorage } from "@/utils/storage/jotai";
import { generateUUID } from "@/utils/uuid";

/**
 * A named, user-defined group of workspace notebooks shown on the home page.
 *
 * Collections are purely cosmetic — they group notebooks visually without
 * moving or renaming anything on disk. `filePaths` stores the workspace tree
 * paths (the same paths used as row ids in the workspace file tree).
 */
export interface NotebookCollection {
  id: string;
  name: string;
  filePaths: string[];
  /** Whether the collection's section is collapsed on the home page. */
  collapsed?: boolean;
}

export interface CollectionsState {
  collections: NotebookCollection[];
}

export const initialCollectionsState: CollectionsState = { collections: [] };

/**
 * localStorage-persisted collections for the home page.
 * Mirrors the persistence pattern of `expandedFoldersAtom` in
 * `src/components/home/state.ts`.
 */
export const collectionsAtom = atomWithStorage<CollectionsState>(
  "marimo:home:collections",
  initialCollectionsState,
  jotaiJsonStorage,
  { getOnInit: true },
);

/**
 * Create a new (empty) collection. Returns the next state and the id of the
 * created collection so callers can immediately act on it (e.g. start an
 * inline rename, or assign a file).
 */
export function createCollection(
  state: CollectionsState,
  name: string,
): { state: CollectionsState; id: string } {
  const id = generateUUID();
  return {
    id,
    state: {
      collections: [...state.collections, { id, name, filePaths: [] }],
    },
  };
}

export function renameCollection(
  state: CollectionsState,
  opts: { id: string; name: string },
): CollectionsState {
  return {
    collections: state.collections.map((c) =>
      c.id === opts.id ? { ...c, name: opts.name } : c,
    ),
  };
}

/**
 * Delete a collection. Its files implicitly return to the ungrouped
 * ("All notebooks") list since membership is stored only on the collection.
 */
export function deleteCollection(
  state: CollectionsState,
  id: string,
): CollectionsState {
  return {
    collections: state.collections.filter((c) => c.id !== id),
  };
}

/**
 * Assign a file path to a collection. A file belongs to at most one
 * collection, so it is removed from any other collection first.
 */
export function addPathToCollection(
  state: CollectionsState,
  opts: { id: string; path: string },
): CollectionsState {
  const { id, path } = opts;
  return {
    collections: state.collections.map((c) => {
      if (c.id === id) {
        return c.filePaths.includes(path)
          ? c
          : { ...c, filePaths: [...c.filePaths, path] };
      }
      return c.filePaths.includes(path)
        ? { ...c, filePaths: c.filePaths.filter((p) => p !== path) }
        : c;
    }),
  };
}

/** Unassign a file path from whichever collection contains it. */
export function removePathFromCollections(
  state: CollectionsState,
  path: string,
): CollectionsState {
  return {
    collections: state.collections.map((c) =>
      c.filePaths.includes(path)
        ? { ...c, filePaths: c.filePaths.filter((p) => p !== path) }
        : c,
    ),
  };
}

export function toggleCollectionCollapsed(
  state: CollectionsState,
  id: string,
): CollectionsState {
  return {
    collections: state.collections.map((c) =>
      c.id === id ? { ...c, collapsed: !c.collapsed } : c,
    ),
  };
}

/** The collection a file path currently belongs to, if any. */
export function collectionContainingPath(
  state: CollectionsState,
  path: string,
): NotebookCollection | undefined {
  return state.collections.find((c) => c.filePaths.includes(path));
}

/** All file paths assigned to any collection. */
export function assignedPaths(state: CollectionsState): Set<string> {
  return new Set(state.collections.flatMap((c) => c.filePaths));
}
