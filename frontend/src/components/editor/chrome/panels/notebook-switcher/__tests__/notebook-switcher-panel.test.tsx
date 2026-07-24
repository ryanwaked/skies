/* Copyright 2026 Marimo. All rights reserved. */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pinnedNotebooksAtom } from "@/components/home/state";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { SessionId } from "@/core/kernel/session";
import type {
  FileCreateResponse,
  FileInfo,
  RecentFilesResponse,
  RunningNotebooksResponse,
  WorkspaceFilesResponse,
} from "@/core/network/types";
import { filenameAtom } from "@/core/saving/file-state";
import { NotebookSwitcherPanel } from "../notebook-switcher-panel";

const mockGetWorkspaceFiles = vi.fn();
const mockGetRunningNotebooks = vi.fn();
const mockGetRecentFiles = vi.fn();
const mockSendCreateFileOrFolder = vi.fn();
const mockShutdownSession = vi.fn();
const mockOpenPrompt = vi.fn();
const mockOpenConfirm = vi.fn();

vi.mock("@/core/network/requests", () => ({
  useRequestClient: () => ({
    getWorkspaceFiles: mockGetWorkspaceFiles,
    getRunningNotebooks: mockGetRunningNotebooks,
    getRecentFiles: mockGetRecentFiles,
    sendCreateFileOrFolder: mockSendCreateFileOrFolder,
    shutdownSession: mockShutdownSession,
  }),
}));

const mockOpenNotebook = vi.fn();
const mockOpenNotebookInCurrentTab = vi.fn();
vi.mock("@/utils/links", () => ({
  openNotebook: (...args: unknown[]) => mockOpenNotebook(...args),
  openNotebookInCurrentTab: (...args: unknown[]) =>
    mockOpenNotebookInCurrentTab(...args),
}));

vi.mock("@/components/modal/ImperativeModal", () => ({
  useImperativeModal: () => ({
    openPrompt: mockOpenPrompt,
    openConfirm: mockOpenConfirm,
    closeModal: vi.fn(),
    openAlert: vi.fn(),
  }),
}));

const notebook = (path: string): FileInfo => ({
  id: path,
  name: path.split("/").pop() ?? path,
  path,
  isDirectory: false,
  isMarimoFile: true,
  children: [],
});

const directory = (path: string, children: FileInfo[]): FileInfo => ({
  id: path,
  name: path,
  path,
  isDirectory: true,
  isMarimoFile: false,
  children,
});

const workspaceResponse: WorkspaceFilesResponse = {
  root: "/project",
  hasMore: false,
  fileCount: 3,
  files: [
    notebook("a.py"),
    directory("notes", [
      notebook("notes/b.py"),
      {
        id: "notes/todo.txt",
        name: "todo.txt",
        path: "notes/todo.txt",
        isDirectory: false,
        isMarimoFile: false,
        children: [],
      },
    ]),
  ],
};

const runningResponse: RunningNotebooksResponse = {
  files: [
    {
      name: "b.py",
      path: "notes/b.py",
      lastModified: 0,
      sessionId: "s_run123" as SessionId,
      initializationId: "init-b",
    },
  ],
};

const recentsResponse: RecentFilesResponse = {
  files: [
    {
      name: "a.py",
      path: "a.py",
      lastModified: 100,
      sessionId: null,
      initializationId: null,
    },
  ],
};

function mockRequests(
  overrides: {
    workspace?: Promise<WorkspaceFilesResponse>;
    running?: Promise<RunningNotebooksResponse>;
    recents?: Promise<RecentFilesResponse>;
  } = {},
) {
  mockGetWorkspaceFiles.mockReturnValue(
    overrides.workspace ?? Promise.resolve(workspaceResponse),
  );
  mockGetRunningNotebooks.mockReturnValue(
    overrides.running ?? Promise.resolve(runningResponse),
  );
  mockGetRecentFiles.mockReturnValue(
    overrides.recents ?? Promise.resolve(recentsResponse),
  );
}

function renderPanel(opts: { filename?: string; pinned?: string[] } = {}) {
  const store = createStore();
  if (opts.filename) {
    store.set(filenameAtom, opts.filename);
  }
  if (opts.pinned) {
    store.set(pinnedNotebooksAtom, opts.pinned);
  }
  return render(
    <Provider store={store}>
      <TooltipProvider>
        <NotebookSwitcherPanel />
      </TooltipProvider>
    </Provider>,
  );
}

describe("NotebookSwitcherPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequests();
  });

  it("shows a loading skeleton while requests are pending", () => {
    mockRequests({
      workspace: new Promise(() => {
        // Never resolves
      }),
    });
    renderPanel();
    expect(screen.getByTestId("notebook-switcher-loading")).toBeInTheDocument();
  });

  it("lists project notebooks, excluding non-marimo files", async () => {
    renderPanel();
    // "a.py" appears in both the Recent and All notebooks sections.
    expect((await screen.findAllByText("a.py")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("b.py").length).toBeGreaterThan(0);
    expect(screen.queryByText("todo.txt")).not.toBeInTheDocument();
    // Folder grouping header
    expect(screen.getByText("notes")).toBeInTheDocument();
    expect(screen.getByText("All notebooks")).toBeInTheDocument();
  });

  it("shows running and recent sections with a running indicator", async () => {
    renderPanel();
    expect(await screen.findByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(
      screen.getAllByTestId("notebook-switcher-running-notes/b.py").length,
    ).toBeGreaterThan(0);
  });

  it("highlights the currently open notebook", async () => {
    renderPanel({ filename: "notes/b.py" });
    const rows = await screen.findAllByTestId(
      "notebook-switcher-row-notes/b.py",
    );
    expect(
      rows.some((row) => row.getAttribute("aria-current") === "true"),
    ).toBe(true);
  });

  it("switches notebooks in the current tab, with session id when running", async () => {
    renderPanel();
    const coldRow = await screen.findAllByTestId("notebook-switcher-row-a.py");
    fireEvent.click(coldRow[0]);
    expect(mockOpenNotebookInCurrentTab).toHaveBeenCalledWith(
      "a.py",
      undefined,
    );

    const runningRow = screen.getAllByTestId(
      "notebook-switcher-row-notes/b.py",
    );
    fireEvent.click(runningRow[0]);
    expect(mockOpenNotebookInCurrentTab).toHaveBeenCalledWith(
      "notes/b.py",
      "s_run123",
    );
  });

  it("filters notebooks by the search input", async () => {
    renderPanel();
    await screen.findAllByText("a.py");
    fireEvent.change(screen.getByTestId("notebook-switcher-search"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText(/No notebooks match/)).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("notebook-switcher-search"), {
      target: { value: "notes" },
    });
    await waitFor(() => {
      expect(screen.queryByTestId("notebook-switcher-row-a.py")).toBeNull();
      expect(
        screen.getAllByTestId("notebook-switcher-row-notes/b.py").length,
      ).toBeGreaterThan(0);
    });
  });

  it("creates a new notebook and switches to it", async () => {
    mockSendCreateFileOrFolder.mockResolvedValue({
      success: true,
      info: {
        ...notebook("new notebook.py"),
        path: "/project/new notebook.py",
      },
    } satisfies Partial<FileCreateResponse>);

    renderPanel();
    await screen.findAllByText("a.py");

    fireEvent.click(screen.getByTestId("notebook-switcher-new-notebook"));
    expect(mockOpenPrompt).toHaveBeenCalledOnce();

    const promptOpts = mockOpenPrompt.mock.calls[0][0] as {
      onConfirm: (value: string) => void;
    };
    await promptOpts.onConfirm("new notebook");

    expect(mockSendCreateFileOrFolder).toHaveBeenCalledWith({
      path: "",
      type: "notebook",
      name: "new notebook.py",
    });
    await waitFor(() => {
      expect(mockOpenNotebookInCurrentTab).toHaveBeenCalledWith(
        "new notebook.py",
      );
    });
  });

  it("shows an empty state when the project has no notebooks", async () => {
    mockRequests({
      workspace: Promise.resolve({
        root: "/project",
        files: [],
        hasMore: false,
        fileCount: 0,
      }),
      running: Promise.resolve({ files: [] }),
      recents: Promise.resolve({ files: [] }),
    });
    renderPanel();
    expect(
      await screen.findByText("No notebooks in this project yet."),
    ).toBeInTheDocument();
  });

  it("shows an error banner when loading fails", async () => {
    mockRequests({
      workspace: Promise.reject(new Error("boom")),
      running: Promise.resolve({ files: [] }),
      recents: Promise.resolve({ files: [] }),
    });
    renderPanel();
    expect(await screen.findByText(/boom/)).toBeInTheDocument();
  });

  it("shows pinned notebooks in a dedicated section", async () => {
    renderPanel({ pinned: ["a.py"] });
    expect(await screen.findByText("Pinned")).toBeInTheDocument();
    const pinnedRow = screen.getAllByTestId("notebook-switcher-row-a.py");
    expect(pinnedRow.length).toBeGreaterThan(0);
  });

  it("opens the actions menu for extra operations", async () => {
    renderPanel();
    await screen.findAllByText("a.py");
    const trigger = screen.getAllByTestId("notebook-switcher-actions-a.py")[0];
    // Radix dropdowns open on ArrowDown from the trigger; this avoids the
    // PointerEvent polyfill that pointerDown would require in jsdom.
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const openInNewTab = await screen.findByText("Open in new tab");
    fireEvent.click(openInNewTab);
    expect(mockOpenNotebook).toHaveBeenCalledWith("a.py");
  });
});
