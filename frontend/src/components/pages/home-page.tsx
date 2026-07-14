/* Copyright 2026 Marimo. All rights reserved. */

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ArrowUpRightIcon,
  ClockIcon,
  CopyIcon,
  FolderIcon,
  FolderPlusIcon,
  LayoutGridIcon,
  ListIcon,
  MoreHorizontalIcon,
  PinIcon,
  PlusIcon,
  RadioIcon,
  RefreshCcwIcon,
  SearchIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import type React from "react";
import { createContext, use, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "react-aria";
import useEvent from "react-use-event-hook";
import { PageSky } from "@/components/skies/page-sky";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import {
  createCollection,
  collectionsAtom,
  deleteCollection,
  type NotebookCollection,
  removePathFromCollections,
  renameCollection,
} from "@/core/home/collections";
import { isSessionId } from "@/core/kernel/session";
import { useRequestClient } from "@/core/network/requests";
import type {
  FileInfo,
  MarimoFile,
  NotebookPreviewResponse,
} from "@/core/network/types";
import { combineAsyncData, useAsyncData } from "@/hooks/useAsyncData";
import { useInterval } from "@/hooks/useInterval";
import { Banner } from "@/plugins/impl/common/error-banner";
import { cn } from "@/utils/cn";
import { timeAgo } from "@/utils/dates";
import { prettyError } from "@/utils/errors";
import { openNotebook } from "@/utils/links";
import { Maps } from "@/utils/maps";
import { asURL } from "@/utils/url";
import { newNotebookURL } from "@/utils/urls";
import { ConfigButton } from "../app-config/app-config-button";
import { ErrorBoundary } from "../editor/boundary/ErrorBoundary";
import { ShutdownButton } from "../editor/controls/shutdown-button";
import {
  useConfirmDeleteFile,
  useFileOperations,
} from "../editor/file-tree/file-operations";
import { Header, OpenTutorialDropDown } from "../home/components";
import { NotebookMiniPreview } from "../home/notebook-mini-preview";
import { useNotebookPreview } from "../home/use-notebook-preview";
import {
  type PaneWidth,
  useContainerWidth,
} from "../home/use-container-width";
import { CollectionMenuItems } from "../home/collections";
import {
  type HomeSort,
  homeSortAtom,
  homeViewAtom,
  includeMarkdownAtom,
  pinnedNotebooksAtom,
  RunningNotebooksContext,
  WorkspaceContext,
} from "../home/state";
import { relativeToRoot, tabTarget } from "../home/notebook-row";
import { Spinner } from "../icons/spinner";
import { Input } from "../ui/input";

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type HomeFilter =
  | { kind: "all" }
  | { kind: "recent" }
  | { kind: "running" }
  | { kind: "pinned" }
  | { kind: "collection"; id: string };

/** A notebook shown as a card/row, normalized across the three data sources. */
interface CardItem {
  /** Path used for the open href and running/pin lookups. */
  path: string;
  name: string;
  lastModified?: number | null;
  /** Present when the item came from the workspace tree (enables file ops). */
  fileInfo?: FileInfo;
  /** For unsaved notebooks whose path is a session id. */
  initializationId?: string | null;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) {return "Working late";}
  if (hour < 12) {return "Good morning";}
  if (hour < 18) {return "Good afternoon";}
  return "Good evening";
}

/** Recursively collect non-directory files from a workspace tree. */
function flattenNotebooks(files: FileInfo[]): FileInfo[] {
  const out: FileInfo[] = [];
  const walk = (list: FileInfo[]) => {
    for (const f of list) {
      if (f.isDirectory) {
        walk(f.children ?? []);
      } else {
        out.push(f);
      }
    }
  };
  walk(files);
  return out;
}

function marimoFileToCard(file: MarimoFile): CardItem {
  return {
    path: file.path,
    name: file.name,
    lastModified: file.lastModified,
    initializationId: file.initializationId,
  };
}

function hrefFor(item: CardItem): string {
  if (isSessionId(item.path)) {
    return asURL(
      `?file=${encodeURIComponent(item.initializationId ?? item.path)}&session_id=${item.path}`,
    ).toString();
  }
  return asURL(`?file=${encodeURIComponent(item.path)}`).toString();
}

function matchesSearch(item: CardItem, q: string): boolean {
  if (!q) {return true;}
  const lower = q.toLowerCase();
  return (
    item.name.toLowerCase().includes(lower) ||
    item.path.toLowerCase().includes(lower)
  );
}

function sortItems(items: CardItem[], sort: HomeSort): CardItem[] {
  return [...items].toSorted((a, b) => {
    if (sort === "name") {return a.name.localeCompare(b.name);}
    return (b.lastModified ?? 0) - (a.lastModified ?? 0);
  });
}

// ---------------------------------------------------------------------------
// Type chips & pane width
// ---------------------------------------------------------------------------

/** The cell kinds a notebook contains, derived from its preview payload. */
type ChipKind = "py" | "sql" | "md" | "viz";

function deriveChips(preview: NotebookPreviewResponse | null): ChipKind[] {
  if (!preview) {
    return [];
  }
  const chips: ChipKind[] = [];
  if (preview.cells.some((c) => c.cellType === "python")) {chips.push("py");}
  if (preview.cells.some((c) => c.cellType === "sql")) {chips.push("sql");}
  if (preview.cells.some((c) => c.cellType === "markdown")) {chips.push("md");}
  if (preview.cells.some((c) => c.visual !== "none")) {chips.push("viz");}
  return chips;
}

const CHIP_CLASS: Record<ChipKind, string> = {
  py: "skies-type-chip skies-type-chip--py",
  sql: "skies-type-chip skies-type-chip--sql",
  md: "skies-type-chip skies-type-chip--md",
  viz: "skies-type-chip skies-type-chip--viz",
};

const TypeChips: React.FC<{ chips: ChipKind[]; max?: number }> = ({
  chips,
  max = 4,
}) =>
  chips.length === 0 ? null : (
    <div className="flex items-center gap-1">
      {chips.slice(0, max).map((chip) => (
        <span key={chip} className={CHIP_CLASS[chip]}>
          {chip}
        </span>
      ))}
    </div>
  );

/** The main scroll pane's width bucket, for the list table's column collapse. */
const PaneWidthContext = createContext<PaneWidth>("wide");

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

const HomePage: React.FC = () => {
  const [nonce, setNonce] = useState(0);
  const { getRecentFiles, getRunningNotebooks } = useRequestClient();

  const recentsResponse = useAsyncData(() => getRecentFiles(), []);

  useInterval(() => setNonce((n) => n + 1), {
    delayMs: 10_000,
    whenVisible: true,
  });

  const runningResponse = useAsyncData(async () => {
    const response = await getRunningNotebooks();
    return Maps.keyBy(response.files, (file) => file.path);
  }, [nonce]);

  const response = combineAsyncData(recentsResponse, runningResponse);
  if (response.error) {
    throw response.error;
  }
  if (!response.data) {
    return <Spinner centered={true} size="xlarge" />;
  }

  const [recents, running] = response.data;

  return (
    <RunningNotebooksContext
      value={{
        runningNotebooks: running,
        setRunningNotebooks: runningResponse.setData,
      }}
    >
      <div className="relative flex h-screen w-full overflow-hidden">
        <PageSky />
        <ErrorBoundary>
          <Workspace
            recents={recents.files}
            running={running}
            onRefreshRecents={recentsResponse.refetch}
          />
        </ErrorBoundary>
      </div>
    </RunningNotebooksContext>
  );
};

export default HomePage;

/**
 * Loads the workspace tree and holds the page's view state (active filter,
 * search, sort, grid/list). Everything below the workspace fetch lives here
 * so the sidebar counts and the main pane stay in sync.
 */
const Workspace: React.FC<{
  recents: MarimoFile[];
  running: Map<string, MarimoFile>;
  onRefreshRecents: () => void;
}> = ({ recents, running, onRefreshRecents }) => {
  const { getWorkspaceFiles } = useRequestClient();
  const includeMarkdown = useAtomValue(includeMarkdownAtom);
  const [filter, setFilter] = useState<HomeFilter>({ kind: "all" });
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const {
    data: workspace,
    error,
    isPending,
    isFetching,
    refetch,
  } = useAsyncData(
    () => getWorkspaceFiles({ includeMarkdown }),
    [includeMarkdown],
  );

  const refreshWorkspace = useEvent(() => {
    refetch();
    onRefreshRecents();
  });

  const root = workspace?.root ?? "";
  const workspaceContextValue = useMemo(
    () => ({ root, refreshWorkspace }),
    [root, refreshWorkspace],
  );

  // "/" focuses search, "n" opens a new notebook (ignored while typing).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Never hijack modifier combos (Cmd/Ctrl+N, etc.) — only bare keys.
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "n") {
        e.preventDefault();
        window.open(newNotebookURL().toString(), "_blank", "noreferrer");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const workspaceCards = useMemo<CardItem[]>(() => {
    if (!workspace) {return [];}
    return flattenNotebooks(workspace.files).map((fi) => ({
      path: relativeToRoot(fi.path, root),
      name: fi.name,
      fileInfo: fi,
    }));
  }, [workspace, root]);

  const runningCards = useMemo(
    () => [...running.values()].map(marimoFileToCard),
    [running],
  );
  const recentCards = useMemo(() => recents.map(marimoFileToCard), [recents]);

  // Paths of notebooks that still exist on disk. Collections store paths in
  // localStorage and are never reconciled against the filesystem, so their
  // badge counts must be derived against this set rather than the raw stored
  // length — otherwise deleted notebooks keep inflating the count.
  const existingPaths = useMemo(
    () =>
      new Set(
        workspaceCards
          .map((c) => c.fileInfo?.path)
          .filter((p): p is string => p != null),
      ),
    [workspaceCards],
  );

  return (
    <WorkspaceContext value={workspaceContextValue}>
      <HomeSidebar
        filter={filter}
        setFilter={setFilter}
        existingPaths={existingPaths}
        counts={{
          all: workspaceCards.length,
          recent: recentCards.length,
          running: running.size,
        }}
      />
      <MainPane
        filter={filter}
        search={search}
        setSearch={setSearch}
        searchRef={searchRef}
        workspaceCards={workspaceCards}
        recentCards={recentCards}
        runningCards={runningCards}
        isPending={isPending}
        isFetching={isFetching}
        error={error}
        hasMore={workspace?.hasMore ?? false}
        fileCount={workspace?.fileCount ?? 0}
        onRefresh={refetch}
      />
    </WorkspaceContext>
  );
};

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

/**
 * Import a notebook from disk into the workspace: uploads the chosen `.py`
 * file to the workspace root via the file-create endpoint, then opens it.
 * A quiet ghost button so the primary "New notebook" CTA stays dominant.
 */
const ImportNotebookButton: React.FC = () => {
  const { sendCreateFileOrFolder } = useRequestClient();
  const { refreshWorkspace } = use(WorkspaceContext);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const importFile = async (file: File | undefined) => {
    if (!file || busy) {
      return;
    }
    setBusy(true);
    // Open the destination tab synchronously, inside the click gesture, so the
    // browser doesn't block it as a popup after the async upload resolves. We
    // point it at the notebook once we know its path (or close it on failure).
    const pending = window.open("", "_blank");
    try {
      const res = await sendCreateFileOrFolder({
        path: "",
        type: "file",
        name: file.name,
        file,
      });
      if (res.success && res.info) {
        toast({ description: `Imported "${file.name}"` });
        // Re-query the workspace so the imported notebook appears in the list
        // (the list is otherwise only fetched once on mount).
        refreshWorkspace();
        const url = asURL(
          `?file=${encodeURIComponent(res.info.path)}`,
        ).toString();
        if (pending && !pending.closed) {
          pending.location.href = url;
        } else {
          // Popup was blocked; fall back (still imported and shown in the list).
          openNotebook(res.info.path);
        }
      } else {
        pending?.close();
        toast({
          variant: "danger",
          title: "Import failed",
          description: res.message ?? "Could not import that notebook.",
        });
      }
    } catch (error) {
      pending?.close();
      toast({
        variant: "danger",
        title: "Import failed",
        description: prettyError(error),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="mt-2 flex h-9 w-full items-center justify-start gap-2 rounded-[var(--radius)] border border-[var(--input)] bg-[var(--secondary)] px-[15px] font-[var(--monospace-font)] text-[12.5px] text-[var(--foreground-dim)] transition-colors hover:border-[var(--foreground-dim)] hover:text-foreground disabled:opacity-50"
      >
        <UploadIcon size={14} strokeWidth={1.8} />
        Import notebook
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".py"
        className="hidden"
        onChange={(e) => {
          void importFile(e.target.files?.[0]);
          // Reset so importing the same file twice re-fires onChange.
          e.target.value = "";
        }}
      />
    </>
  );
};

const HomeSidebar: React.FC<{
  filter: HomeFilter;
  setFilter: (f: HomeFilter) => void;
  existingPaths: Set<string>;
  counts: { all: number; recent: number; running: number };
}> = ({ filter, setFilter, existingPaths, counts }) => {
  const [{ collections }, setCollections] = useAtom(collectionsAtom);
  // Which collection is being renamed, tracked by identity (not by name) so a
  // freshly-created collection opens in edit mode without every other
  // collection that happens to share the default name doing the same.
  const [editingId, setEditingId] = useState<string | null>(null);

  const addCollection = () => {
    const { state, id } = createCollection(
      { collections },
      "Untitled collection",
    );
    setCollections(state);
    setFilter({ kind: "collection", id });
    setEditingId(id);
  };

  return (
    <aside className="relative z-10 flex h-full w-60 shrink-0 flex-col border-r border-border bg-[var(--nav-solid)]/95 backdrop-blur-sm">
      <div className="px-4 pt-5 pb-3">
        <p className="skies-kicker">skies</p>
        <h1 className="mt-1 font-[var(--heading-font)] text-2xl font-bold tracking-[-0.012em] text-foreground">
          Notebooks
        </h1>
      </div>

      <div className="px-3">
        <a
          className="skies-cta skies-ticks relative h-9 w-full justify-start"
          href={newNotebookURL().toString()}
          target="_blank"
          rel="noreferrer"
        >
          <PlusIcon size={15} strokeWidth={2} />
          New notebook
          <kbd className="ml-auto font-mono text-[10px] opacity-60">n</kbd>
        </a>
        <ImportNotebookButton />
      </div>

      <nav className="mt-4 flex flex-col gap-0.5 px-2">
        <NavRow
          icon={<LayoutGridIcon size={15} strokeWidth={1.5} />}
          label="All notebooks"
          count={counts.all}
          active={filter.kind === "all"}
          onClick={() => setFilter({ kind: "all" })}
        />
        <NavRow
          icon={<ClockIcon size={15} strokeWidth={1.5} />}
          label="Recent"
          count={counts.recent}
          active={filter.kind === "recent"}
          onClick={() => setFilter({ kind: "recent" })}
        />
        <NavRow
          icon={<RadioIcon size={15} strokeWidth={1.5} />}
          label="Running"
          count={counts.running}
          live={counts.running > 0}
          active={filter.kind === "running"}
          onClick={() => setFilter({ kind: "running" })}
        />
        <NavRow
          icon={<PinIcon size={15} strokeWidth={1.5} />}
          label="Pinned"
          active={filter.kind === "pinned"}
          onClick={() => setFilter({ kind: "pinned" })}
        />
      </nav>

      <div className="mt-5 flex items-center justify-between px-4">
        <span className="skies-kicker">collections</span>
        <button
          type="button"
          aria-label="New collection"
          onClick={addCollection}
          className="text-[var(--foreground-dim)] hover:text-foreground"
        >
          <FolderPlusIcon size={14} strokeWidth={1.5} />
        </button>
      </div>
      <div className="mt-1 flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {collections.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-[var(--foreground-dim)]">
            Group notebooks into collections from a card's ··· menu.
          </p>
        )}
        {collections.map((collection) => (
          <CollectionRow
            key={collection.id}
            collection={collection}
            existingPaths={existingPaths}
            active={
              filter.kind === "collection" && filter.id === collection.id
            }
            isEditing={editingId === collection.id}
            onStartEditing={() => setEditingId(collection.id)}
            onStopEditing={() => setEditingId(null)}
            onSelect={() =>
              setFilter({ kind: "collection", id: collection.id })
            }
            onRename={(name) =>
              setCollections(
                renameCollection({ collections }, { id: collection.id, name }),
              )
            }
            onDelete={() => {
              setCollections(deleteCollection({ collections }, collection.id));
              setFilter({ kind: "all" });
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-1 border-t border-border px-3 py-2">
        <OpenTutorialDropDown />
        <ConfigButton showAppConfig={false} />
        <ShutdownButton description="This will shut down the notebook server and terminate all running notebooks. You'll lose all in-memory data." />
      </div>
    </aside>
  );
};

const NavRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  count?: number;
  live?: boolean;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, count, live, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-center gap-2.5 rounded-[4px] px-2.5 py-1.5 text-[13px] transition-colors",
      active
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground hover:bg-[var(--hover-wash)] hover:text-foreground",
    )}
  >
    <span
      className={cn(
        "shrink-0",
        live && "text-[var(--success)]",
        active && "text-accent-foreground",
      )}
    >
      {icon}
    </span>
    <span className="flex-1 text-left">{label}</span>
    {count != null && count > 0 && (
      <span className="font-mono text-[11px] text-[var(--foreground-dim)]">
        {count}
      </span>
    )}
  </button>
);

const CollectionRow: React.FC<{
  collection: NotebookCollection;
  existingPaths: Set<string>;
  active: boolean;
  isEditing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}> = ({
  collection,
  existingPaths,
  active,
  isEditing,
  onStartEditing,
  onStopEditing,
  onSelect,
  onRename,
  onDelete,
}) => {
  const [draft, setDraft] = useState(collection.name);
  // Count only notebooks that still exist on disk, matching the main pane
  // which filters the collection against the live workspace.
  const count = collection.filePaths.filter((p) =>
    existingPaths.has(p),
  ).length;

  if (isEditing) {
    return (
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={true}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onStopEditing();
          if (draft.trim()) {onRename(draft.trim());}
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {e.currentTarget.blur();}
          if (e.key === "Escape") {
            setDraft(collection.name);
            onStopEditing();
          }
        }}
        className="mx-1 rounded-[4px] border border-input bg-card px-2 py-1 text-[13px] outline-none focus:border-primary"
      />
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 rounded-[4px] px-2.5 py-1.5 text-[13px] transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-[var(--hover-wash)] hover:text-foreground",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 items-center gap-2.5 overflow-hidden text-left"
      >
        <FolderIcon size={15} strokeWidth={1.5} className="shrink-0" />
        <span className="flex-1 truncate">{collection.name}</span>
        <span className="font-mono text-[11px] text-[var(--foreground-dim)]">
          {count}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild={true}>
          <button
            type="button"
            aria-label="Collection actions"
            className="opacity-0 group-hover:opacity-100 text-[var(--foreground-dim)] hover:text-foreground"
          >
            <MoreHorizontalIcon size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onSelect={() => {
              setDraft(collection.name);
              onStartEditing();
            }}
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="danger"
            onSelect={onDelete}
          >
            Delete collection
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main pane
// ---------------------------------------------------------------------------

const FILTER_LABELS: Record<HomeFilter["kind"], string> = {
  all: "All notebooks",
  recent: "Recent",
  running: "Running now",
  pinned: "Pinned",
  collection: "Collection",
};

const MainPane: React.FC<{
  filter: HomeFilter;
  search: string;
  setSearch: (s: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  workspaceCards: CardItem[];
  recentCards: CardItem[];
  runningCards: CardItem[];
  isPending: boolean;
  isFetching: boolean;
  error: Error | null | undefined;
  hasMore: boolean;
  fileCount: number;
  onRefresh: () => void;
}> = ({
  filter,
  search,
  setSearch,
  searchRef,
  workspaceCards,
  recentCards,
  runningCards,
  isPending,
  isFetching,
  error,
  hasMore,
  fileCount,
  onRefresh,
}) => {
  const [sort, setSort] = useAtom(homeSortAtom);
  const [view, setView] = useAtom(homeViewAtom);
  const collections = useAtomValue(collectionsAtom).collections;

  const activeCollection =
    filter.kind === "collection"
      ? collections.find((c) => c.id === filter.id)
      : undefined;

  const title =
    filter.kind === "collection"
      ? (activeCollection?.name ?? "Collection")
      : FILTER_LABELS[filter.kind];

  const items = useMemo(() => {
    let base: CardItem[];
    switch (filter.kind) {
      case "recent":
        base = recentCards;
        break;
      case "running":
        base = runningCards;
        break;
      case "pinned": 
        base = [];
        break; // resolved in the Grid/List via the pinned set
      
      case "collection": {
        const paths = new Set(activeCollection?.filePaths ?? []);
        // collection filePaths are workspace tree paths; match by fileInfo path
        base = workspaceCards.filter(
          (c) => c.fileInfo && paths.has(c.fileInfo.path),
        );
        break;
      }
      default:
        base = workspaceCards;
    }
    const filtered = base.filter((c) => matchesSearch(c, search));
    return sortItems(filtered, sort);
  }, [
    filter,
    activeCollection,
    workspaceCards,
    recentCards,
    runningCards,
    search,
    sort,
  ]);

  const bodyRef = useRef<HTMLDivElement>(null);
  const paneWidth = useContainerWidth(bodyRef);

  const allCount = workspaceCards.length;
  const runningCount = runningCards.length;

  // Surface pinned + running zones above the main list only on the default,
  // unsearched browsing surfaces; every other view stays a flat surface.
  const zoned = !search && (filter.kind === "all" || filter.kind === "recent");

  return (
    <main className="relative z-10 flex min-w-0 flex-1 flex-col">
      <header className="skies-masthead relative z-10 flex shrink-0 flex-col px-6 pt-5 pb-3">
        {/* Row 1 — masthead meta */}
        <div className="flex items-baseline gap-3">
          <p className="skies-kicker">{greeting()}</p>
          <span className="ml-auto font-mono text-[10px] uppercase tabular-nums text-[var(--foreground-dim)]">
            {allCount} notebooks
            {runningCount > 0 && ` · ${runningCount} running`}
            {hasMore && filter.kind === "all" && ` · first ${fileCount} shown`}
          </span>
        </div>
        {/* Row 2 — title + controls */}
        <div className="mt-1 flex items-end gap-3">
          <h2 className="font-[var(--heading-font)] text-[2.25rem] font-bold leading-[1.2] tracking-[-0.012em] text-foreground">
            {title}
          </h2>
          <span className="mb-1 font-mono text-[15px] tabular-nums text-[var(--foreground-dim)]">
            ({items.length})
          </span>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <SearchIcon
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--foreground-dim)]"
              />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearch("");
                    e.currentTarget.blur();
                  }
                }}
                placeholder="filter index…"
                className="mb-0 h-8 w-56 border-border pl-8 font-mono text-[12px] placeholder:text-[var(--foreground-dim)]"
              />
            </div>
            <SortToggle sort={sort} onChange={setSort} />
            <ViewToggle view={view} onChange={setView} />
            <button
              type="button"
              aria-label="Refresh"
              onClick={onRefresh}
              className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[var(--foreground-dim)] hover:bg-[var(--hover-wash)] hover:text-foreground"
            >
              {isFetching ? (
                <Spinner size="small" />
              ) : (
                <RefreshCcwIcon size={14} />
              )}
            </button>
          </div>
        </div>
      </header>

      <div
        ref={bodyRef}
        className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-4"
      >
        {error ? (
          <Banner kind="danger" className="rounded p-4">
            {prettyError(error)}
          </Banner>
        ) : isPending ? (
          <Spinner centered={true} size="large" className="mt-10" />
        ) : (
          <PaneWidthContext value={paneWidth}>
            <ZoneRouter
              zoned={zoned}
              filter={filter}
              view={view}
              search={search}
              items={items}
              runningCards={runningCards}
            />
          </PaneWidthContext>
        )}
      </div>
    </main>
  );
};

// ---------------------------------------------------------------------------
// Zone router (pinned + running shelves above the main list)
// ---------------------------------------------------------------------------

/** Resolve pinned paths into cards, enriching from the running set when known. */
function resolvePinnedItems(
  pinned: string[],
  runningNotebooks: Map<string, MarimoFile>,
): CardItem[] {
  const known = new Map<string, CardItem>();
  for (const [path, file] of runningNotebooks) {
    known.set(path, marimoFileToCard(file));
  }
  return pinned.map(
    (path): CardItem =>
      known.get(path) ?? { path, name: path.split("/").pop() ?? path },
  );
}

const ZoneRouter: React.FC<{
  zoned: boolean;
  filter: HomeFilter;
  view: "grid" | "list";
  search: string;
  items: CardItem[];
  runningCards: CardItem[];
}> = ({ zoned, filter, view, search, items, runningCards }) => {
  const pinned = useAtomValue(pinnedNotebooksAtom);
  const { runningNotebooks } = use(RunningNotebooksContext);

  // Recomputed only when the pinned or running set changes — not on every
  // 10s running-poll re-render (ZoneRouter re-renders when the poll nonce
  // changes even though pinned/running are referentially identical).
  const pinnedItems = useMemo(
    () => resolvePinnedItems(pinned, runningNotebooks),
    [pinned, runningNotebooks],
  );

  const main = (
    <NotebookCollectionView
      items={items}
      filter={filter}
      view={view}
      search={search}
    />
  );

  if (!zoned) {
    return main;
  }

  return (
    <div className="flex flex-col gap-6">
      {pinnedItems.length > 0 && (
        <section>
          <Header>pinned</Header>
          <div className="mt-3">
            <CardGrid items={pinnedItems} pinned={pinned} />
          </div>
        </section>
      )}
      {runningCards.length > 0 && (
        <section>
          <Header>running</Header>
          <div className="mt-3">
            <CardList
              items={runningCards}
              runningNotebooks={runningNotebooks}
              pinned={pinned}
              showHeader={false}
            />
          </div>
        </section>
      )}
      <section>
        {(pinnedItems.length > 0 || runningCards.length > 0) && (
          <Header>{filter.kind === "recent" ? "all recent" : "all notebooks"}</Header>
        )}
        <div
          className={
            pinnedItems.length > 0 || runningCards.length > 0 ? "mt-3" : ""
          }
        >
          {main}
        </div>
      </section>
    </div>
  );
};

const SortToggle: React.FC<{
  sort: HomeSort;
  onChange: (s: HomeSort) => void;
}> = ({ sort, onChange }) => (
  <div className="flex items-center gap-0.5 rounded-[4px] border border-border p-0.5">
    {(["recent", "name"] as const).map((opt) => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(opt)}
        className={cn(
          "rounded-[3px] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors",
          sort === opt
            ? "bg-accent text-accent-foreground"
            : "text-[var(--foreground-dim)] hover:text-foreground",
        )}
      >
        {opt}
      </button>
    ))}
  </div>
);

const ViewToggle: React.FC<{
  view: "grid" | "list";
  onChange: (v: "grid" | "list") => void;
}> = ({ view, onChange }) => (
  <div className="flex items-center gap-0.5 rounded-[4px] border border-border p-0.5">
    <button
      type="button"
      aria-label="Grid view"
      onClick={() => onChange("grid")}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-[3px]",
        view === "grid"
          ? "bg-accent text-accent-foreground"
          : "text-[var(--foreground-dim)] hover:text-foreground",
      )}
    >
      <LayoutGridIcon size={14} strokeWidth={1.5} />
    </button>
    <button
      type="button"
      aria-label="List view"
      onClick={() => onChange("list")}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-[3px]",
        view === "list"
          ? "bg-accent text-accent-foreground"
          : "text-[var(--foreground-dim)] hover:text-foreground",
      )}
    >
      <ListIcon size={14} strokeWidth={1.5} />
    </button>
  </div>
);

/** Renders the active filter's notebooks as a grid or list. */
const NotebookCollectionView: React.FC<{
  items: CardItem[];
  filter: HomeFilter;
  view: "grid" | "list";
  search: string;
}> = ({ items, filter, view, search }) => {
  const pinned = useAtomValue(pinnedNotebooksAtom);
  const { runningNotebooks } = use(RunningNotebooksContext);

  // The pinned filter resolves its own set (from running + pinned paths).
  if (filter.kind === "pinned") {
    return <PinnedView view={view} search={search} />;
  }

  if (items.length === 0) {
    const title = search
      ? `No entries match “${search}”.`
      : filter.kind === "running"
        ? "No notebooks running."
        : filter.kind === "collection"
          ? "No notebooks in this collection yet."
          : "No notebooks in this index yet.";
    return (
      <EmptyState title={title} showNew={!search && filter.kind === "all"} />
    );
  }

  return view === "grid" ? (
    <CardGrid items={items} pinned={pinned} />
  ) : (
    <CardList
      items={items}
      runningNotebooks={runningNotebooks}
      pinned={pinned}
    />
  );
};

const EmptyState: React.FC<{ title: string; showNew?: boolean }> = ({
  title,
  showNew,
}) => (
  <div className="skies-paper skies-ticks mx-auto mt-6 flex max-w-md flex-col items-center gap-3 px-8 py-10 text-center">
    <p className="skies-kicker">empty index</p>
    <p className="font-[var(--heading-font)] text-[15px] text-foreground">
      {title}
    </p>
    {showNew && (
      <a
        className="skies-cta mt-1"
        href={newNotebookURL().toString()}
        target="_blank"
        rel="noreferrer"
      >
        <PlusIcon size={14} strokeWidth={2} />
        New notebook
      </a>
    )}
  </div>
);

const CardGrid: React.FC<{
  items: CardItem[];
  pinned: string[];
}> = ({ items, pinned }) => (
  <div className="grid grid-cols-[repeat(auto-fill,minmax(216px,1fr))] gap-3">
    {items.map((item) => (
      <NotebookCard
        key={item.path}
        item={item}
        isPinned={pinned.includes(item.path)}
      />
    ))}
  </div>
);

/** Column template shared by the list header and its rows, per pane width. */
function listTemplate(paneWidth: PaneWidth): string {
  switch (paneWidth) {
    case "narrow":
      return "grid-cols-[minmax(0,1fr)_auto_auto]";
    case "mid":
      return "grid-cols-[minmax(0,2.4fr)_auto_auto_auto]";
    default:
      return "grid-cols-[minmax(0,2.4fr)_minmax(0,3fr)_auto_auto_auto]";
  }
}

const SortHeader: React.FC<{
  label: string;
  caret: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}> = ({ label, caret, active, onClick, className }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-center gap-1 uppercase hover:text-foreground",
      active && "text-foreground",
      className,
    )}
  >
    {label}
    {active && <span aria-hidden={true}>{caret}</span>}
  </button>
);

const CardList: React.FC<{
  items: CardItem[];
  runningNotebooks: Map<string, MarimoFile>;
  pinned: string[];
  showHeader?: boolean;
}> = ({ items, runningNotebooks, pinned, showHeader = true }) => {
  const paneWidth = use(PaneWidthContext);
  const [sort, setSort] = useAtom(homeSortAtom);
  const template = cn("grid items-center gap-4", listTemplate(paneWidth));
  const showPath = paneWidth === "wide";
  const showCells = paneWidth !== "narrow";

  return (
    <div className="skies-paper">
      {showHeader && (
        <div
          className={cn(
            template,
            "sticky top-0 z-10 border-b border-border bg-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--foreground-dim)]",
          )}
        >
          <SortHeader
            label="name"
            caret="↑"
            active={sort === "name"}
            onClick={() => setSort("name")}
          />
          {showPath && <span>path</span>}
          {showCells && <span>cells</span>}
          <SortHeader
            label="modified"
            caret="↓"
            active={sort === "recent"}
            onClick={() => setSort("recent")}
            className="justify-end text-right"
          />
          <span />
        </div>
      )}
      {items.map((item) => (
        <NotebookListItem
          key={item.path}
          item={item}
          isRunning={runningNotebooks.has(item.path)}
          isPinned={pinned.includes(item.path)}
          template={template}
          showPath={showPath}
          showCells={showCells}
        />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Pinned view (self-contained: resolves the pinned set across all sources)
// ---------------------------------------------------------------------------

const PinnedView: React.FC<{ view: "grid" | "list"; search: string }> = ({
  view,
  search,
}) => {
  const pinned = useAtomValue(pinnedNotebooksAtom);
  const { runningNotebooks } = use(RunningNotebooksContext);

  const items: CardItem[] = useMemo(
    () =>
      resolvePinnedItems(pinned, runningNotebooks).filter((c) =>
        matchesSearch(c, search),
      ),
    [pinned, runningNotebooks, search],
  );

  if (items.length === 0) {
    return (
      <EmptyState title="Pin entries from a card's ··· menu to keep them here." />
    );
  }

  return view === "grid" ? (
    <CardGrid items={items} pinned={pinned} />
  ) : (
    <CardList items={items} runningNotebooks={runningNotebooks} pinned={pinned} />
  );
};

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

const NotebookCard: React.FC<{
  item: CardItem;
  isPinned: boolean;
}> = ({ item, isPinned }) => {
  const { locale } = useLocale();
  const previewRef = useRef<HTMLDivElement>(null);
  const { preview, status } = useNotebookPreview(item.path, previewRef);
  const chips = deriveChips(preview);

  return (
    // The anchor is an inset click-target so the pin/menu buttons can sit
    // ABOVE it as siblings (nesting buttons inside an <a> is invalid HTML).
    <div className="skies-ticks group relative flex flex-col rounded-[var(--radius)] border border-border bg-card transition-[transform,border-color,box-shadow] duration-150 ease-out hover:-translate-y-px hover:border-[var(--foreground-dim)] hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:transform-none">
      <a
        href={hrefFor(item)}
        target={tabTarget(item.initializationId || item.path)}
        aria-label={item.name}
        className="absolute inset-0 z-0"
      />
      <div
        ref={previewRef}
        className="pointer-events-none relative aspect-[4/3] overflow-hidden rounded-t-[var(--radius)] border-b border-border"
      >
        <NotebookMiniPreview
          path={item.path}
          name={item.name}
          preview={preview}
          status={status}
        />
        {/* No "live" pill here — the RUNNING shelf above the grid already
            names the running notebooks; repeating it overlapped the title. */}
      </div>
      <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <PinButton path={item.path} isPinned={isPinned} onCover={true} />
        <CardMenu item={item} isPinned={isPinned} onCover={true} />
      </div>
      <div className="pointer-events-none relative flex flex-col gap-1 px-2.5 py-2">
        {/* Line A — worded title (first markdown heading), else the filename */}
        <div className="flex items-center gap-1.5">
          <span
            title={preview?.title || item.name}
            className="truncate text-[13px] font-medium text-foreground"
          >
            {preview?.title || item.name}
          </span>
          {isPinned && (
            <PinIcon
              size={11}
              className="shrink-0 text-[var(--gold)]"
              fill="currentColor"
            />
          )}
        </div>
        {/* Line B — the file name */}
        <div className="flex items-center gap-2 font-mono text-[10px] tabular-nums text-[var(--foreground-dim)]">
          <span title={item.path} className="truncate">
            {item.name}
          </span>
          {!!item.lastModified && (
            <span className="ml-auto shrink-0">
              {timeAgo(item.lastModified * 1000, locale)}
            </span>
          )}
        </div>
        {/* Line C — type chips */}
        {chips.length > 0 && (
          <div className="mt-0.5">
            <TypeChips chips={chips} max={4} />
          </div>
        )}
      </div>
    </div>
  );
};

const NotebookListItem: React.FC<{
  item: CardItem;
  isRunning: boolean;
  isPinned: boolean;
  template: string;
  showPath: boolean;
  showCells: boolean;
}> = ({ item, isRunning, isPinned, template, showPath, showCells }) => {
  const { locale } = useLocale();
  const rowRef = useRef<HTMLDivElement>(null);
  const { preview, status } = useNotebookPreview(item.path, rowRef);
  const chips = deriveChips(preview);

  return (
    <div
      ref={rowRef}
      className={cn(
        template,
        "group relative border-b border-border px-3 py-2 transition-colors last:border-b-0 hover:bg-[var(--hover-wash)]",
      )}
    >
      {/* Inset anchor click-target; interactive buttons sit above it. */}
      <a
        href={hrefFor(item)}
        target={tabTarget(item.initializationId || item.path)}
        aria-label={item.name}
        className="absolute inset-0 z-0"
      />
      {/* NAME */}
      <div className="pointer-events-none relative flex min-w-0 items-center gap-2">
        <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-[3px] border border-border">
          <NotebookMiniPreview path={item.path} name={item.name} compact={true} />
        </div>
        <span className="truncate text-[13px] font-medium text-foreground">
          {item.name}
        </span>
        {isPinned && (
          <PinIcon
            size={11}
            className="shrink-0 text-[var(--gold)]"
            fill="currentColor"
          />
        )}
        {isRunning && (
          <span className="skies-status shrink-0">
            <i className="skies-status__dot skies-ping" />
            live
          </span>
        )}
      </div>
      {/* PATH */}
      {showPath && (
        <span
          title={item.path}
          className="pointer-events-none relative truncate font-mono text-[11px] tabular-nums text-[var(--foreground-dim)]"
        >
          {item.path}
        </span>
      )}
      {/* CELLS / TYPE */}
      {showCells && (
        <div className="pointer-events-none relative flex items-center gap-1">
          {status === "ready" && preview && preview.totalCells > 0 && (
            <span className="font-mono text-[10px] tabular-nums text-[var(--foreground-dim)]">
              {preview.totalCells}c
            </span>
          )}
          <TypeChips chips={chips} max={3} />
        </div>
      )}
      {/* MODIFIED */}
      <span className="pointer-events-none relative shrink-0 text-right font-mono text-[10.5px] tabular-nums text-[var(--foreground-dim)]">
        {item.lastModified ? timeAgo(item.lastModified * 1000, locale) : ""}
      </span>
      {/* ACTIONS */}
      <div className="relative z-10 flex shrink-0 items-center gap-1">
        <PinButton path={item.path} isPinned={isPinned} onCover={false} />
        <CardMenu item={item} isPinned={isPinned} onCover={false} />
        <ArrowUpRightIcon
          size={15}
          strokeWidth={1.5}
          className="pointer-events-none shrink-0 text-[var(--foreground-dim)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
        />
      </div>
    </div>
  );
};

const PinButton: React.FC<{
  path: string;
  isPinned: boolean;
  onCover: boolean;
}> = ({ path, isPinned, onCover }) => {
  const setPinned = useSetAtom(pinnedNotebooksAtom);
  return (
    <button
      type="button"
      aria-label={isPinned ? "Unpin" : "Pin"}
      aria-pressed={isPinned}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setPinned((prev) =>
          isPinned ? prev.filter((p) => p !== path) : [...prev, path],
        );
      }}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-[4px]",
        onCover
          ? "border border-border bg-card/80 text-foreground backdrop-blur-sm hover:bg-card"
          : cn(
              "shrink-0",
              isPinned
                ? "text-[var(--gold)]"
                : "text-[var(--foreground-dim)] opacity-0 group-hover:opacity-100 hover:text-foreground",
            ),
      )}
    >
      <PinIcon
        size={13}
        strokeWidth={1.5}
        fill={isPinned ? "currentColor" : "none"}
      />
    </button>
  );
};

const CardMenu: React.FC<{
  item: CardItem;
  isPinned: boolean;
  onCover: boolean;
}> = ({ item, isPinned, onCover }) => {
  const setPinned = useSetAtom(pinnedNotebooksAtom);
  const setCollections = useSetAtom(collectionsAtom);
  const { root, refreshWorkspace } = use(WorkspaceContext);
  const { duplicateFile, deleteFile } = useFileOperations({ root });
  const confirmDelete = useConfirmDeleteFile();

  const fileInfo = item.fileInfo;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild={true}>
        <button
          type="button"
          aria-label="Notebook actions"
          onClick={(e) => e.preventDefault()}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-[4px]",
            onCover
              ? "border border-border bg-card/80 text-foreground backdrop-blur-sm hover:bg-card"
              : "shrink-0 text-[var(--foreground-dim)] opacity-0 group-hover:opacity-100 hover:text-foreground",
          )}
        >
          <MoreHorizontalIcon size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          onSelect={() =>
            setPinned((prev) =>
              isPinned ? prev.filter((p) => p !== item.path) : [...prev, item.path],
            )
          }
        >
          <PinIcon className="mr-2 size-3.5" strokeWidth={1.5} />
          {isPinned ? "Unpin" : "Pin to top"}
        </DropdownMenuItem>
        {fileInfo && (
          <CollectionMenuItems path={fileInfo.path} leadingSeparator={true} />
        )}
        {fileInfo && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                const ok = await duplicateFile(fileInfo);
                if (ok) {refreshWorkspace();}
              }}
            >
              <CopyIcon className="mr-2 size-3.5" strokeWidth={1.5} />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="danger"
              onSelect={() =>
                confirmDelete(fileInfo, async () => {
                  const ok = await deleteFile(fileInfo);
                  if (ok) {
                    // Drop the deleted notebook from any collection so its
                    // stored membership doesn't go stale.
                    setCollections((s) =>
                      removePathFromCollections(s, fileInfo.path),
                    );
                    refreshWorkspace();
                  }
                })
              }
            >
              <Trash2Icon className="mr-2 size-3.5" strokeWidth={1.5} />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
