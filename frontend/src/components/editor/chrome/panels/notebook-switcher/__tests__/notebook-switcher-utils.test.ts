/* Copyright 2026 Marimo. All rights reserved. */

import { describe, expect, it } from "vitest";
import type { SessionId } from "@/core/kernel/session";
import type { FileInfo, MarimoFile } from "@/core/network/types";
import {
  buildNotebookSections,
  directoryOf,
  flattenNotebooks,
  isCurrentPath,
  navigationTarget,
  relativeToRoot,
} from "../notebook-switcher-utils";

const notebook = (path: string): FileInfo => ({
  id: path,
  name: path.split("/").pop() ?? path,
  path,
  isDirectory: false,
  isMarimoFile: true,
  children: [],
});

const plainFile = (path: string): FileInfo => ({
  ...notebook(path),
  isMarimoFile: false,
});

const directory = (path: string, children: FileInfo[]): FileInfo => ({
  id: path,
  name: path.split("/").pop() ?? path,
  path,
  isDirectory: true,
  isMarimoFile: false,
  children,
});

const marimoFile = (
  path: string,
  extra: Partial<MarimoFile> = {},
): MarimoFile => ({
  name: path.split("/").pop() ?? path,
  path,
  lastModified: 0,
  sessionId: null,
  initializationId: null,
  ...extra,
});

describe("flattenNotebooks", () => {
  it("collects only marimo files, recursively", () => {
    const tree = [
      notebook("a.py"),
      directory("notes", [notebook("notes/b.py"), plainFile("notes/todo.txt")]),
      plainFile("README.txt"),
    ];
    expect(flattenNotebooks(tree).map((f) => f.path)).toEqual([
      "a.py",
      "notes/b.py",
    ]);
  });
});

describe("relativeToRoot", () => {
  it("strips the workspace root from absolute paths", () => {
    expect(relativeToRoot("/project/notes/b.py", "/project")).toBe(
      "notes/b.py",
    );
  });

  it("leaves relative paths untouched", () => {
    expect(relativeToRoot("notes/b.py", "/project")).toBe("notes/b.py");
  });

  it("leaves absolute paths untouched when no root is known", () => {
    expect(relativeToRoot("/project/a.py", "")).toBe("/project/a.py");
  });
});

describe("directoryOf", () => {
  it("returns the folder portion, or empty at the root", () => {
    expect(directoryOf("a.py")).toBe("");
    expect(directoryOf("notes/b.py")).toBe("notes");
    expect(directoryOf("deep/nested/c.py")).toBe("deep/nested");
  });
});

describe("isCurrentPath", () => {
  it("matches workspace-relative paths", () => {
    expect(isCurrentPath("notes/b.py", "notes/b.py")).toBe(true);
    expect(isCurrentPath("./notes/b.py", "notes/b.py")).toBe(true);
  });

  it("matches absolute filenames ending in the relative path", () => {
    expect(isCurrentPath("/project/notes/b.py", "notes/b.py")).toBe(true);
  });

  it("rejects different paths and null", () => {
    expect(isCurrentPath("a.py", "notes/b.py")).toBe(false);
    expect(isCurrentPath(null, "notes/b.py")).toBe(false);
    // Suffix collisions must not match ("/xb.py" does not end with "/b.py"... but "notes/xb.py" must not match "b.py")
    expect(isCurrentPath("notes/xb.py", "b.py")).toBe(false);
  });
});

describe("buildNotebookSections", () => {
  const workspaceFiles = [
    notebook("a.py"),
    directory("notes", [notebook("notes/b.py"), notebook("notes/c.md")]),
  ];
  const running = new Map<string, MarimoFile>([
    [
      "notes/b.py",
      marimoFile("notes/b.py", {
        sessionId: "s1" as SessionId,
        initializationId: "i1",
      }),
    ],
    // Unsaved notebook: path is the session id.
    [
      "s_abc123",
      marimoFile("s_abc123", {
        name: "new notebook",
        sessionId: "s_abc123" as SessionId,
        initializationId: "init-unsaved",
      }),
    ],
  ]);
  const recents = [marimoFile("notes/c.md"), marimoFile("a.py")];

  const build = (
    overrides: Partial<Parameters<typeof buildNotebookSections>[0]> = {},
  ) =>
    buildNotebookSections({
      workspaceFiles,
      running,
      recents,
      pinned: [],
      currentFilename: null,
      query: "",
      ...overrides,
    });

  it("lists every workspace notebook in 'all', sorted by path", () => {
    const sections = build();
    expect(sections.all.map((i) => i.path)).toEqual([
      "a.py",
      "notes/b.py",
      "notes/c.md",
    ]);
    expect(sections.all[1].directory).toBe("notes");
  });

  it("overlays running state with session ids", () => {
    const sections = build();
    const runningPaths = sections.running.map((i) => i.path);
    expect(runningPaths).toContain("notes/b.py");
    expect(runningPaths).toContain("s_abc123");
    const b = sections.running.find((i) => i.path === "notes/b.py");
    expect(b?.isRunning).toBe(true);
    expect(b?.sessionId).toBe("s1");
    // Unsaved notebook surfaces even though it is not in the workspace tree.
    const unsaved = sections.running.find((i) => i.path === "s_abc123");
    expect(unsaved?.name).toBe("new notebook");
  });

  it("marks the current notebook", () => {
    const sections = build({ currentFilename: "notes/b.py" });
    expect(sections.all.find((i) => i.path === "notes/b.py")?.isCurrent).toBe(
      true,
    );
    expect(sections.all.find((i) => i.path === "a.py")?.isCurrent).toBe(false);
  });

  it("builds the recent section from recents, capped and non-session", () => {
    const sections = build();
    expect(sections.recent.map((i) => i.path)).toEqual(["notes/c.md", "a.py"]);
  });

  it("resolves pinned paths to items", () => {
    const sections = build({ pinned: ["notes/b.py", "missing.py"] });
    expect(sections.pinned.map((i) => i.path)).toEqual(["notes/b.py"]);
    expect(sections.pinned[0].isPinned).toBe(true);
  });

  it("filters every section by the search query", () => {
    const sections = build({ query: "notes/" });
    expect(sections.all.map((i) => i.path)).toEqual([
      "notes/b.py",
      "notes/c.md",
    ]);
    expect(sections.running.map((i) => i.path)).toEqual(["notes/b.py"]);
    expect(sections.recent.map((i) => i.path)).toEqual(["notes/c.md"]);
  });
});

describe("navigationTarget", () => {
  const base = {
    name: "b.py",
    directory: "notes",
    isCurrent: false,
    isPinned: false,
  };

  it("passes the session id for warm resume of running notebooks", () => {
    expect(
      navigationTarget({
        ...base,
        path: "notes/b.py",
        isRunning: true,
        sessionId: "s1" as SessionId,
      }),
    ).toEqual({ fileKey: "notes/b.py", sessionId: "s1" as SessionId });
  });

  it("omits the session id for cold notebooks", () => {
    expect(
      navigationTarget({ ...base, path: "notes/b.py", isRunning: false }),
    ).toEqual({ fileKey: "notes/b.py", sessionId: undefined });
  });

  it("navigates unsaved notebooks by initialization id", () => {
    expect(
      navigationTarget({
        ...base,
        path: "s_xyz789",
        isRunning: true,
        sessionId: "s_xyz789" as SessionId,
        initializationId: "init-1",
      }),
    ).toEqual({ fileKey: "init-1", sessionId: "s_xyz789" as SessionId });
  });
});
