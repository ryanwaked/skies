/* Copyright 2026 Marimo. All rights reserved. */

import { isSessionId, type SessionId } from "@/core/kernel/session";
import type { FileInfo, MarimoFile } from "@/core/network/types";
import { type FilePath, Paths } from "@/utils/paths";

/**
 * A notebook row in the switcher, normalized across the three data sources
 * (workspace tree, running sessions, recent files).
 */
export interface NotebookItem {
  /**
   * Workspace file key (path relative to the workspace root), used as the
   * `?file=` navigation target and as the join key across data sources.
   * For running-but-unsaved notebooks this is the session id instead.
   */
  path: string;
  name: string;
  lastModified?: number | null;
  /** Folder portion of `path` ("" when the notebook lives at the root). */
  directory: string;
  isRunning: boolean;
  sessionId?: SessionId | null;
  /** For unsaved notebooks whose `path` is a session id. */
  initializationId?: string | null;
  isCurrent: boolean;
  isPinned: boolean;
}

export interface NotebookSections {
  pinned: NotebookItem[];
  running: NotebookItem[];
  recent: NotebookItem[];
  all: NotebookItem[];
}

/** Cap on the "Recent" section so the switcher stays compact. */
export const MAX_RECENT_ITEMS = 5;

/** Recursively collect marimo notebooks from a workspace tree. */
export function flattenNotebooks(files: FileInfo[]): FileInfo[] {
  const out: FileInfo[] = [];
  const walk = (list: FileInfo[]) => {
    for (const file of list) {
      if (file.isDirectory) {
        walk(file.children ?? []);
      } else if (file.isMarimoFile) {
        out.push(file);
      }
    }
  };
  walk(files);
  return out;
}

/** Convert an absolute path into a path relative to the workspace root. */
export function relativeToRoot(path: string, root: string): string {
  return root && Paths.isAbsolute(path) && path.startsWith(root)
    ? Paths.rest(path as FilePath, root as FilePath)
    : path;
}

/** The folder portion of a workspace-relative path ("" at the root). */
export function directoryOf(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

/**
 * Whether `filename` (from `filenameAtom`, possibly absolute or prefixed
 * with "./") refers to the workspace-relative `path`.
 */
export function isCurrentPath(filename: string | null, path: string): boolean {
  if (!filename) {
    return false;
  }
  const normalized = filename.replace(/^\.\//, "");
  return (
    normalized === path ||
    // Absolute filenames (single-file mode, or depending on how the server
    // rendered the tag) end with the workspace-relative path.
    normalized.endsWith(`/${path}`)
  );
}

function matchesSearch(
  item: Pick<NotebookItem, "name" | "path">,
  query: string,
): boolean {
  if (!query) {
    return true;
  }
  const lower = query.toLowerCase();
  return (
    item.name.toLowerCase().includes(lower) ||
    item.path.toLowerCase().includes(lower)
  );
}

/**
 * Group the flattened workspace notebooks and overlay running / pinned /
 * recent state. Every section is already filtered by `query`; sections may
 * legitimately repeat a notebook (home-page semantics: curated zones above
 * the complete list).
 */
export function buildNotebookSections(opts: {
  workspaceFiles: FileInfo[];
  running: ReadonlyMap<string, MarimoFile>;
  recents: MarimoFile[];
  pinned: readonly string[];
  currentFilename: string | null;
  query: string;
}): NotebookSections {
  const { workspaceFiles, running, recents, pinned, currentFilename, query } =
    opts;

  const toItem = (file: FileInfo): NotebookItem => {
    const runningFile = running.get(file.path);
    return {
      path: file.path,
      name: file.name,
      lastModified: file.lastModified,
      directory: directoryOf(file.path),
      isRunning: runningFile !== undefined,
      sessionId: runningFile?.sessionId,
      initializationId: runningFile?.initializationId,
      isCurrent: isCurrentPath(currentFilename, file.path),
      isPinned: pinned.includes(file.path),
    };
  };

  const all = flattenNotebooks(workspaceFiles)
    .toSorted((a, b) => a.path.localeCompare(b.path))
    .map(toItem)
    .filter((item) => matchesSearch(item, query));

  const byPath = new Map(all.map((item) => [item.path, item]));

  const itemForMarimoFile = (file: MarimoFile): NotebookItem => {
    const known = byPath.get(file.path);
    if (known) {
      return known;
    }
    const runningFile = running.get(file.path);
    return {
      path: file.path,
      name: file.name,
      lastModified: file.lastModified,
      directory: directoryOf(file.path),
      isRunning: runningFile !== undefined,
      sessionId: runningFile?.sessionId ?? file.sessionId,
      initializationId: file.initializationId,
      isCurrent: isCurrentPath(currentFilename, file.path),
      isPinned: pinned.includes(file.path),
    };
  };

  // Running notebooks are keyed by path; include unsaved ones (whose path
  // is a session id) even though they never appear in the workspace tree.
  // Sort by path so the section order is stable across polls.
  const runningItems = [...running.values()]
    .toSorted((a, b) => a.path.localeCompare(b.path))
    .map(itemForMarimoFile)
    .filter((item) => matchesSearch(item, query));

  const recentItems = recents
    .filter((file) => !isSessionId(file.path))
    .slice(0, MAX_RECENT_ITEMS)
    .map(itemForMarimoFile)
    .filter((item) => matchesSearch(item, query));

  const pinnedItems = pinned
    .map((path) => byPath.get(path))
    .filter((item): item is NotebookItem => item !== undefined)
    .filter((item) => matchesSearch(item, query));

  return {
    pinned: pinnedItems,
    running: runningItems,
    recent: recentItems,
    all,
  };
}

/**
 * Navigation arguments for a notebook item. Unsaved running notebooks (path
 * is a session id) navigate by initialization id with the session id for a
 * warm resume, mirroring `hrefFor` on the home page.
 */
export function navigationTarget(item: NotebookItem): {
  fileKey: string;
  sessionId?: SessionId;
} {
  if (isSessionId(item.path)) {
    return {
      fileKey: item.initializationId ?? item.path,
      sessionId: item.path,
    };
  }
  return { fileKey: item.path, sessionId: item.sessionId ?? undefined };
}
