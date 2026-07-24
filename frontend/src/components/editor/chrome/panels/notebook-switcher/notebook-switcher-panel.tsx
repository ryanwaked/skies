/* Copyright 2026 Marimo. All rights reserved. */

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ExternalLinkIcon,
  FolderIcon,
  ListTreeIcon,
  NotebookIcon,
  NotebookPenIcon,
  PinIcon,
  PinOffIcon,
  PowerOffIcon,
  RefreshCwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import type React from "react";
import { useMemo, useRef, useState } from "react";
import useEvent from "react-use-event-hook";
import { FileActionsDropdown } from "@/components/editor/file-tree/file-operations";
import { handleFileResponse } from "@/components/editor/file-tree/requesting-tree";
import { revealPathAtom } from "@/components/editor/file-tree/state";
import { MENU_ITEM_ICON_CLASS } from "@/components/editor/file-tree/tree-actions";
import { pinnedNotebooksAtom, RUNNING_NOTEBOOKS_POLL_INTERVAL_MS } from "@/components/home/state";
import { useImperativeModal } from "@/components/modal/ImperativeModal";
import { AlertDialogDestructiveAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { isSessionId } from "@/core/kernel/session";
import { useRequestClient } from "@/core/network/requests";
import type { FileInfo, MarimoFile } from "@/core/network/types";
import { filenameAtom } from "@/core/saving/file-state";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useInterval } from "@/hooks/useInterval";
import { ErrorBanner } from "@/plugins/impl/common/error-banner";
import { cn } from "@/utils/cn";
import { openNotebook, openNotebookInCurrentTab } from "@/utils/links";
import { Maps } from "@/utils/maps";
import { PathBuilder } from "@/utils/paths";
import { useChromeActions } from "../../state";
import { PanelEmptyState } from "../empty-state";
import {
  PANEL_EYEBROW,
  PANEL_SEARCH_INPUT,
  PANEL_SEARCH_INPUT_ROOT,
  PANEL_SEARCH_ROW,
} from "../panel-styles";
import {
  buildNotebookSections,
  type NotebookItem,
  type NotebookSections,
  navigationTarget,
  relativeToRoot,
} from "./notebook-switcher-utils";

interface SwitcherData {
  workspaceRoot: string;
  workspaceFiles: FileInfo[];
  recents: MarimoFile[];
}

export const NotebookSwitcherPanel: React.FC = () => {
  const {
    getWorkspaceFiles,
    getRunningNotebooks,
    getRecentFiles,
    sendCreateFileOrFolder,
    shutdownSession,
  } = useRequestClient();
  const { openApplication } = useChromeActions();
  const { openPrompt, openConfirm, closeModal } = useImperativeModal();

  const filename = useAtomValue(filenameAtom);
  const [pinned, setPinned] = useAtom(pinnedNotebooksAtom);
  const setRevealPath = useSetAtom(revealPathAtom);
  const [query, setQuery] = useState("");
  const [nonce, setNonce] = useState(0);

  // Poll running sessions only: cheap, and keeps the Running section fresh
  // without refetching (and reordering) the workspace/recent lists under
  // the cursor. The full lists refetch on mount and on explicit actions.
  useInterval(() => setNonce((n) => n + 1), {
    delayMs: RUNNING_NOTEBOOKS_POLL_INTERVAL_MS,
    whenVisible: true,
  });

  const { data, isPending, error, refetch } = useAsyncData<SwitcherData>(
    async () => {
      const [workspace, recents] = await Promise.all([
        getWorkspaceFiles({ includeMarkdown: true }),
        getRecentFiles(),
      ]);
      return {
        workspaceRoot: workspace.root,
        workspaceFiles: workspace.files,
        recents: recents.files,
      };
    },
    [],
  );

  const { data: runningFiles, refetch: refetchRunning } = useAsyncData(
    async () => {
      const running = await getRunningNotebooks();
      return running.files;
    },
    [nonce],
  );

  const refreshAll = useEvent(() => {
    refetch();
    refetchRunning();
  });

  // Preserve the Running section's row order across polls so entries don't
  // shift under the cursor; newly started notebooks append at the end.
  const runningOrderRef = useRef<string[]>([]);
  const sections = useMemo(() => {
    if (!data) {
      return null;
    }
    const running = Maps.keyBy(runningFiles ?? [], (file) => file.path);
    const next = buildNotebookSections({
      workspaceFiles: data.workspaceFiles,
      running,
      recents: data.recents,
      pinned,
      currentFilename: filename,
      query,
    });
    const byPath = new Map(next.running.map((item) => [item.path, item]));
    const previous = runningOrderRef.current;
    const kept = previous
      .map((path) => byPath.get(path))
      .filter((item): item is NotebookItem => item !== undefined);
    const keptPaths = new Set(kept.map((item) => item.path));
    const stabilized = [
      ...kept,
      ...next.running.filter((item) => !keptPaths.has(item.path)),
    ];
    runningOrderRef.current = stabilized.map((item) => item.path);
    return { ...next, running: stabilized };
  }, [data, runningFiles, pinned, filename, query]);

  const handleSwitch = useEvent((item: NotebookItem) => {
    const { fileKey, sessionId } = navigationTarget(item);
    openNotebookInCurrentTab(fileKey, sessionId);
  });

  const handleTogglePin = useEvent((item: NotebookItem) => {
    setPinned(
      item.isPinned
        ? pinned.filter((path) => path !== item.path)
        : [...pinned, item.path],
    );
  });

  const handleShutdown = useEvent((item: NotebookItem) => {
    if (!item.sessionId) {
      return;
    }
    const sessionId = item.sessionId;
    openConfirm({
      title: "Shutdown",
      description:
        "This will terminate the Python kernel. You'll lose all data that's in memory.",
      variant: "destructive",
      confirmAction: (
        <AlertDialogDestructiveAction
          aria-label="Confirm Shutdown"
          onClick={async () => {
            await shutdownSession({ sessionId });
            closeModal();
            toast({ description: "Notebook has been shutdown." });
            refreshAll();
          }}
        >
          Shutdown
        </AlertDialogDestructiveAction>
      ),
    });
  });

  const handleCreateNotebook = useEvent(() => {
    openPrompt({
      title: "Notebook name",
      defaultValue: "notebook.py",
      spellCheck: false,
      confirmText: "Create",
      onConfirm: async (name) => {
        const hasExtension = /\.(py|md|qmd)$/.test(name);
        const response = await sendCreateFileOrFolder({
          // An empty path means "the workspace root".
          path: "",
          type: "notebook",
          name: hasExtension ? name : `${name}.py`,
        }).then(handleFileResponse);
        if (!response?.info) {
          return;
        }
        const fileKey = relativeToRoot(
          response.info.path,
          data?.workspaceRoot ?? "",
        );
        refreshAll();
        openNotebookInCurrentTab(fileKey);
      },
    });
  });

  const revealInFileExplorer = useEvent((item: NotebookItem) => {
    // Unsaved running notebooks have no workspace file to reveal; for them
    // the item simply opens the Files panel.
    if (!isSessionId(item.path) && data?.workspaceRoot) {
      const builder = PathBuilder.guessDeliminator(data.workspaceRoot);
      setRevealPath(builder.join(data.workspaceRoot, item.path));
    }
    openApplication("files");
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card">
      <div className={PANEL_SEARCH_ROW}>
        <div
          className={cn(PANEL_SEARCH_INPUT_ROOT, "flex items-center gap-1.5")}
        >
          <SearchIcon
            strokeWidth={1.5}
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter notebooks..."
            spellCheck={false}
            className={cn(
              PANEL_SEARCH_INPUT,
              "flex-1 min-w-0 bg-transparent text-foreground outline-none",
            )}
            data-testid="notebook-switcher-search"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear filter"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => setQuery("")}
            >
              <XIcon className="w-3 h-3" />
            </button>
          )}
        </div>
        <Tooltip content="New notebook">
          <Button
            variant="text"
            size="xs"
            aria-label="New notebook"
            data-testid="notebook-switcher-new-notebook"
            onClick={handleCreateNotebook}
          >
            <NotebookPenIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Button>
        </Tooltip>
        <Tooltip content="Refresh">
          <Button
            variant="text"
            size="xs"
            aria-label="Refresh notebooks"
            onClick={refreshAll}
          >
            <RefreshCwIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
          </Button>
        </Tooltip>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {isPending && <LoadingSkeleton />}
        {error && <ErrorBanner error={error} />}
        {sections && (
          <SwitcherSections
            sections={sections}
            query={query}
            onSwitch={handleSwitch}
            onTogglePin={handleTogglePin}
            onShutdown={handleShutdown}
            onReveal={revealInFileExplorer}
            onCreateNotebook={handleCreateNotebook}
          />
        )}
      </div>
    </div>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div
    className="flex flex-col gap-1.5 px-1.5 py-3"
    data-testid="notebook-switcher-loading"
  >
    <Skeleton className="h-3 w-16 mx-1.5 mb-1" />
    {Array.from({ length: 4 }, (_, i) => (
      <Skeleton key={i} className="h-7 w-full rounded-[3px]" />
    ))}
  </div>
);

const SwitcherSections: React.FC<{
  sections: NotebookSections;
  query: string;
  onSwitch: (item: NotebookItem) => void;
  onTogglePin: (item: NotebookItem) => void;
  onShutdown: (item: NotebookItem) => void;
  onReveal: (item: NotebookItem) => void;
  onCreateNotebook: () => void;
}> = ({
  sections,
  query,
  onSwitch,
  onTogglePin,
  onShutdown,
  onReveal,
  onCreateNotebook,
}) => {
  const isEmpty = sections.all.length === 0 && sections.running.length === 0;

  if (isEmpty) {
    return query ? (
      <PanelEmptyState
        icon={<SearchIcon />}
        title={`No notebooks match “${query}”.`}
      />
    ) : (
      <PanelEmptyState
        icon={<NotebookIcon />}
        title="No notebooks in this project yet."
        action={
          <Button variant="link" size="sm" onClick={onCreateNotebook}>
            Create your first notebook
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col pb-2">
      {sections.pinned.length > 0 && (
        <Section title="Pinned">
          {sections.pinned.map((item) => (
            <NotebookRow
              key={`pinned-${item.path}`}
              item={item}
              onSwitch={onSwitch}
              onTogglePin={onTogglePin}
              onShutdown={onShutdown}
              onReveal={onReveal}
            />
          ))}
        </Section>
      )}
      {sections.running.length > 0 && (
        <Section title="Running">
          {sections.running.map((item) => (
            <NotebookRow
              key={`running-${item.path}`}
              item={item}
              hideRunningDot={true}
              onSwitch={onSwitch}
              onTogglePin={onTogglePin}
              onShutdown={onShutdown}
              onReveal={onReveal}
            />
          ))}
        </Section>
      )}
      {sections.recent.length > 0 && (
        <Section title="Recent">
          {sections.recent.map((item) => (
            <NotebookRow
              key={`recent-${item.path}`}
              item={item}
              onSwitch={onSwitch}
              onTogglePin={onTogglePin}
              onShutdown={onShutdown}
              onReveal={onReveal}
            />
          ))}
        </Section>
      )}
      {sections.all.length > 0 && (
        <Section title="All notebooks" lastItem={true}>
          <GroupedRows
            items={sections.all}
            onSwitch={onSwitch}
            onTogglePin={onTogglePin}
            onShutdown={onShutdown}
            onReveal={onReveal}
          />
        </Section>
      )}
    </div>
  );
};

const SECTION_HEADER_CLASS = cn(PANEL_EYEBROW, "px-3 py-1.5 select-none");

const Section: React.FC<{
  title: string;
  lastItem?: boolean;
  children: React.ReactNode;
}> = ({ title, lastItem, children }) => (
  <section
    className={cn("flex flex-col", !lastItem && "border-b border-border")}
  >
    <h3 className={SECTION_HEADER_CLASS}>{title}</h3>
    <div className="flex flex-col pb-1">{children}</div>
  </section>
);

/** All-notebooks list with lightweight folder group headers. */
const GroupedRows: React.FC<{
  items: NotebookItem[];
  onSwitch: (item: NotebookItem) => void;
  onTogglePin: (item: NotebookItem) => void;
  onShutdown: (item: NotebookItem) => void;
  onReveal: (item: NotebookItem) => void;
}> = ({ items, onSwitch, onTogglePin, onShutdown, onReveal }) => {
  const rows: React.ReactNode[] = [];
  let lastDirectory: string | null = null;
  for (const item of items) {
    if (item.directory !== lastDirectory) {
      lastDirectory = item.directory;
      if (item.directory) {
        rows.push(
          <div
            key={`dir-${item.directory}`}
            className="flex items-center gap-1.5 px-3 pt-1.5 pb-0.5 text-xs text-muted-foreground"
          >
            <FolderIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="truncate">{item.directory}</span>
          </div>,
        );
      }
    }
    rows.push(
      <NotebookRow
        key={item.path}
        item={item}
        indent={item.directory !== ""}
        onSwitch={onSwitch}
        onTogglePin={onTogglePin}
        onShutdown={onShutdown}
        onReveal={onReveal}
      />,
    );
  }
  return rows;
};

const NotebookRow: React.FC<{
  item: NotebookItem;
  /** Suppress the running dot (redundant inside the Running section). */
  hideRunningDot?: boolean;
  /** Indent under a directory group header. */
  indent?: boolean;
  onSwitch: (item: NotebookItem) => void;
  onTogglePin: (item: NotebookItem) => void;
  onShutdown: (item: NotebookItem) => void;
  onReveal: (item: NotebookItem) => void;
}> = ({
  item,
  hideRunningDot,
  indent,
  onSwitch,
  onTogglePin,
  onShutdown,
  onReveal,
}) => {
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 h-7 mx-1.5 pr-1 rounded-[3px] text-[13px] cursor-pointer select-none",
        indent ? "pl-3.5" : "pl-1.5",
        item.isCurrent
          ? "bg-primary/[0.07] text-primary"
          : "hover:bg-[var(--hover-wash)]",
      )}
      aria-current={item.isCurrent ? "true" : undefined}
      data-testid={`notebook-switcher-row-${item.path}`}
      onClick={() => onSwitch(item)}
    >
      <NotebookIcon
        className={cn(
          "w-4 h-4 shrink-0",
          item.isCurrent ? "text-primary" : "text-muted-foreground",
        )}
        strokeWidth={1.5}
      />
      <span className="flex-1 truncate" title={item.path}>
        {item.name}
      </span>
      {item.isRunning && !hideRunningDot && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-success shrink-0 mr-1"
          title="Running"
          data-testid={`notebook-switcher-running-${item.path}`}
        />
      )}
      <FileActionsDropdown
        testId={`notebook-switcher-actions-${item.path}`}
        contentClassName="print:hidden min-w-[180px] w-fit"
      >
        <DropdownMenuItem
          onSelect={() => {
            // Same tab-reuse semantics as home rows (named target), with a
            // warm-resume session id so a second kernel never starts silently.
            const { fileKey, sessionId } = navigationTarget(item);
            openNotebook(fileKey, sessionId ?? undefined);
          }}
        >
          <ExternalLinkIcon className={MENU_ITEM_ICON_CLASS} />
          Open in new tab
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onReveal(item)}>
          <ListTreeIcon className={MENU_ITEM_ICON_CLASS} />
          Reveal in file explorer
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onTogglePin(item)}>
          {item.isPinned ? (
            <>
              <PinOffIcon className={MENU_ITEM_ICON_CLASS} />
              Unpin
            </>
          ) : (
            <>
              <PinIcon className={MENU_ITEM_ICON_CLASS} />
              Pin to top
            </>
          )}
        </DropdownMenuItem>
        {item.isRunning && item.sessionId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="danger"
              onSelect={() => onShutdown(item)}
            >
              <PowerOffIcon className={MENU_ITEM_ICON_CLASS} />
              Shutdown session
            </DropdownMenuItem>
          </>
        )}
      </FileActionsDropdown>
    </div>
  );
};
