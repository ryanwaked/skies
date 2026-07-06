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
} from "lucide-react";
import type React from "react";
import { use, useEffect, useMemo, useRef, useState } from "react";
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
import {
  createCollection,
  collectionsAtom,
  deleteCollection,
  type NotebookCollection,
  renameCollection,
} from "@/core/home/collections";
import { isSessionId } from "@/core/kernel/session";
import { useRequestClient } from "@/core/network/requests";
import type { FileInfo, MarimoFile } from "@/core/network/types";
import { combineAsyncData, useAsyncData } from "@/hooks/useAsyncData";
import { useInterval } from "@/hooks/useInterval";
import { Banner } from "@/plugins/impl/common/error-banner";
import { cn } from "@/utils/cn";
import { timeAgo } from "@/utils/dates";
import { prettyError } from "@/utils/errors";
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
import { OpenTutorialDropDown } from "../home/components";
import { NotebookCover } from "../home/notebook-cover";
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

  return (
    <WorkspaceContext value={workspaceContextValue}>
      <HomeSidebar
        filter={filter}
        setFilter={setFilter}
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

const HomeSidebar: React.FC<{
  filter: HomeFilter;
  setFilter: (f: HomeFilter) => void;
  counts: { all: number; recent: number; running: number };
}> = ({ filter, setFilter, counts }) => {
  const [{ collections }, setCollections] = useAtom(collectionsAtom);

  const addCollection = () => {
    const { state, id } = createCollection(
      { collections },
      "Untitled collection",
    );
    setCollections(state);
    setFilter({ kind: "collection", id });
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
          className="skies-cta h-9 w-full justify-center"
          href={newNotebookURL().toString()}
          target="_blank"
          rel="noreferrer"
        >
          <PlusIcon size={15} strokeWidth={2} />
          New notebook
          <kbd className="ml-auto font-mono text-[10px] opacity-60">n</kbd>
        </a>
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
            active={
              filter.kind === "collection" && filter.id === collection.id
            }
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
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}> = ({ collection, active, onSelect, onRename, onDelete }) => {
  const [editing, setEditing] = useState(collection.name === "Untitled collection");
  const [draft, setDraft] = useState(collection.name);

  if (editing) {
    return (
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={true}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim()) {onRename(draft.trim());}
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {e.currentTarget.blur();}
          if (e.key === "Escape") {
            setDraft(collection.name);
            setEditing(false);
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
          {collection.filePaths.length}
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
              setEditing(true);
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

  return (
    <main className="relative z-10 flex min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 flex-col gap-3 px-6 pt-5 pb-3">
        <div className="flex items-baseline gap-3">
          <p className="skies-kicker">{greeting()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-[var(--heading-font)] text-xl font-bold tracking-[-0.012em] text-foreground">
            {title}
          </h2>
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
                placeholder="Search…"
                className="mb-0 h-8 w-56 border-border pl-8 text-sm"
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

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-10">
        {error ? (
          <Banner kind="danger" className="rounded p-4">
            {prettyError(error)}
          </Banner>
        ) : isPending ? (
          <Spinner centered={true} size="large" className="mt-10" />
        ) : (
          <>
            {hasMore && filter.kind === "all" && (
              <Banner kind="warn" className="mb-3 rounded p-3 text-xs">
                Showing the first {fileCount} files. Your workspace has more.
              </Banner>
            )}
            <NotebookCollectionView
              items={items}
              filter={filter}
              view={view}
              search={search}
            />
          </>
        )}
      </div>
    </main>
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
    return (
      <EmptyState
        message={
          search ? "No notebooks match your search." : "No notebooks here yet."
        }
      />
    );
  }

  return view === "grid" ? (
    <CardGrid
      items={items}
      runningNotebooks={runningNotebooks}
      pinned={pinned}
    />
  ) : (
    <CardList
      items={items}
      runningNotebooks={runningNotebooks}
      pinned={pinned}
    />
  );
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-[var(--foreground-dim)]">
    <LayoutGridIcon size={22} strokeWidth={1.5} />
    <p className="text-sm">{message}</p>
  </div>
);

const CardGrid: React.FC<{
  items: CardItem[];
  runningNotebooks: Map<string, MarimoFile>;
  pinned: string[];
}> = ({ items, runningNotebooks, pinned }) => (
  <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-4">
    {items.map((item) => (
      <NotebookCard
        key={item.path}
        item={item}
        isRunning={runningNotebooks.has(item.path)}
        isPinned={pinned.includes(item.path)}
      />
    ))}
  </div>
);

const CardList: React.FC<{
  items: CardItem[];
  runningNotebooks: Map<string, MarimoFile>;
  pinned: string[];
}> = ({ items, runningNotebooks, pinned }) => (
  <div className="skies-paper flex flex-col divide-y divide-border overflow-hidden">
    {items.map((item) => (
      <NotebookListItem
        key={item.path}
        item={item}
        isRunning={runningNotebooks.has(item.path)}
        isPinned={pinned.includes(item.path)}
      />
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Pinned view (self-contained: resolves the pinned set across all sources)
// ---------------------------------------------------------------------------

const PinnedView: React.FC<{ view: "grid" | "list"; search: string }> = ({
  view,
  search,
}) => {
  const pinned = useAtomValue(pinnedNotebooksAtom);
  const { runningNotebooks } = use(RunningNotebooksContext);

  const items: CardItem[] = useMemo(() => {
    const known = new Map<string, CardItem>();
    for (const [path, file] of runningNotebooks) {
      known.set(path, marimoFileToCard(file));
    }
    return pinned
      .map(
        (path): CardItem =>
          known.get(path) ?? { path, name: path.split("/").pop() ?? path },
      )
      .filter((c) => matchesSearch(c, search));
  }, [pinned, runningNotebooks, search]);

  if (items.length === 0) {
    return (
      <EmptyState message="Pin notebooks from a card's ··· menu to keep them here." />
    );
  }

  return view === "grid" ? (
    <CardGrid items={items} runningNotebooks={runningNotebooks} pinned={pinned} />
  ) : (
    <CardList items={items} runningNotebooks={runningNotebooks} pinned={pinned} />
  );
};

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

const NotebookCard: React.FC<{
  item: CardItem;
  isRunning: boolean;
  isPinned: boolean;
}> = ({ item, isRunning, isPinned }) => {
  const { locale } = useLocale();
  const isMarkdown = item.path.endsWith(".md") || item.path.endsWith(".qmd");

  return (
    // The anchor is an inset click-target so the pin/menu buttons can sit
    // ABOVE it as siblings (nesting buttons inside an <a> is invalid HTML).
    <div className="group relative flex flex-col overflow-hidden rounded-[6px] border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-[var(--foreground-dim)] hover:shadow-md">
      <a
        href={hrefFor(item)}
        target={tabTarget(item.initializationId || item.path)}
        aria-label={item.name}
        className="absolute inset-0 z-0"
      />
      <div className="pointer-events-none relative aspect-[16/9] overflow-hidden">
        <NotebookCover
          path={item.path}
          name={item.name}
          className="h-full w-full"
        />
        {isRunning && (
          <span className="skies-status absolute left-2 top-2 backdrop-blur-sm">
            <i className="skies-status__dot skies-ping" />
            live
          </span>
        )}
      </div>
      <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <PinButton path={item.path} isPinned={isPinned} onCover={true} />
        <CardMenu item={item} isPinned={isPinned} onCover={true} />
      </div>
      <div className="pointer-events-none relative flex flex-col gap-0.5 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
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
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            title={item.path}
            className="truncate font-mono text-[10px] text-[var(--foreground-dim)]"
          >
            {item.path}
          </span>
          {!!item.lastModified && (
            <span className="shrink-0 font-mono text-[10px] text-[var(--foreground-dim)]">
              {timeAgo(item.lastModified * 1000, locale)}
            </span>
          )}
          {isMarkdown && (
            <span className="shrink-0 font-mono text-[10px] text-[var(--foreground-dim)]">
              md
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const NotebookListItem: React.FC<{
  item: CardItem;
  isRunning: boolean;
  isPinned: boolean;
}> = ({ item, isRunning, isPinned }) => {
  const { locale } = useLocale();
  return (
    <div className="group relative flex items-center gap-3 px-3 py-2 transition-colors hover:bg-[var(--hover-wash)]">
      {/* Inset anchor click-target; interactive buttons sit above it. */}
      <a
        href={hrefFor(item)}
        target={tabTarget(item.initializationId || item.path)}
        aria-label={item.name}
        className="absolute inset-0 z-0"
      />
      <div className="pointer-events-none relative h-8 w-12 shrink-0 overflow-hidden rounded-[4px] border border-border">
        <NotebookCover
          path={item.path}
          name={item.name}
          className="h-full w-full"
        />
      </div>
      <div className="pointer-events-none relative flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 truncate text-[13px] font-medium text-foreground">
          {item.name}
          {isPinned && (
            <PinIcon
              size={11}
              className="shrink-0 text-[var(--gold)]"
              fill="currentColor"
            />
          )}
          {isRunning && (
            <span className="skies-status">
              <i className="skies-status__dot skies-ping" />
              live
            </span>
          )}
        </span>
        <span
          title={item.path}
          className="truncate font-mono text-[10px] text-[var(--foreground-dim)]"
        >
          {item.path}
        </span>
      </div>
      {!!item.lastModified && (
        <span className="pointer-events-none relative shrink-0 font-mono text-[10.5px] text-[var(--foreground-dim)]">
          {timeAgo(item.lastModified * 1000, locale)}
        </span>
      )}
      <div className="relative z-10 flex shrink-0 items-center gap-1">
        <PinButton path={item.path} isPinned={isPinned} onCover={false} />
        <CardMenu item={item} isPinned={isPinned} onCover={false} />
      </div>
      <ArrowUpRightIcon
        size={15}
        strokeWidth={1.5}
        className="pointer-events-none relative shrink-0 text-[var(--foreground-dim)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
      />
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
          ? "bg-[var(--nav-solid)]/70 text-white backdrop-blur-sm hover:bg-[var(--nav-solid)]"
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
              ? "bg-[var(--nav-solid)]/70 text-white backdrop-blur-sm hover:bg-[var(--nav-solid)]"
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
                  if (ok) {refreshWorkspace();}
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
