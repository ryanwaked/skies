/* Copyright 2026 Marimo. All rights reserved. */

import { useAtom, useAtomValue } from "jotai";
import {
  ExternalLinkIcon,
  FolderIcon,
  ListTreeIcon,
  NotebookPenIcon,
  NotebookTextIcon,
  PinIcon,
  PinOffIcon,
  PowerOffIcon,
  RefreshCwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import useEvent from "react-use-event-hook";
import { FileActionsDropdown } from "@/components/editor/file-tree/file-operations";
import { handleFileResponse } from "@/components/editor/file-tree/requesting-tree";
import { MENU_ITEM_ICON_CLASS } from "@/components/editor/file-tree/tree-actions";
import { pinnedNotebooksAtom } from "@/components/home/state";
import { useImperativeModal } from "@/components/modal/ImperativeModal";
import { AlertDialogDestructiveAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { useRequestClient } from "@/core/network/requests";
import type { FileInfo, MarimoFile } from "@/core/network/types";
import { filenameAtom } from "@/core/saving/file-state";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useInterval } from "@/hooks/useInterval";
import { ErrorBanner } from "@/plugins/impl/common/error-banner";
import { cn } from "@/utils/cn";
import { openNotebook, openNotebookInCurrentTab } from "@/utils/links";
import { Maps } from "@/utils/maps";
import { useChromeActions } from "../../state";
import {
  buildNotebookSections,
  type NotebookItem,
  type NotebookSections,
  navigationTarget,
  relativeToRoot,
} from "./notebook-switcher-utils";

/** Poll interval for running sessions, mirroring the home page. */
const RUNNING_POLL_INTERVAL_MS = 10_000;

interface SwitcherData {
  workspaceRoot: string;
  workspaceFiles: FileInfo[];
  running: Map<string, MarimoFile>;
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
  const [query, setQuery] = useState("");
  const [nonce, setNonce] = useState(0);

  // Keep running sessions fresh while the panel is open.
  useInterval(() => setNonce((n) => n + 1), {
    delayMs: RUNNING_POLL_INTERVAL_MS,
    whenVisible: true,
  });

  const { data, isPending, error, refetch } = useAsyncData<SwitcherData>(
    async () => {
      const [workspace, running, recents] = await Promise.all([
        getWorkspaceFiles({ includeMarkdown: true }),
        getRunningNotebooks(),
        getRecentFiles(),
      ]);
      return {
        workspaceRoot: workspace.root,
        workspaceFiles: workspace.files,
        running: Maps.keyBy(running.files, (file) => file.path),
        recents: recents.files,
      };
    },
    [nonce],
  );

  const sections = data
    ? buildNotebookSections({
        workspaceFiles: data.workspaceFiles,
        running: data.running,
        recents: data.recents,
        pinned,
        currentFilename: filename,
        query,
      })
    : null;

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
            refetch();
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
        refetch();
        openNotebookInCurrentTab(fileKey);
      },
    });
  });

  const revealInFileExplorer = useEvent(() => {
    openApplication("files");
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-card">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border shrink-0">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter notebooks..."
            className="h-6 pl-6 pr-5 text-xs shadow-none"
            data-testid="notebook-switcher-search"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear filter"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
            onClick={() => refetch()}
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
  <div className="flex flex-col gap-2 p-3" data-testid="notebook-switcher-loading">
    {Array.from({ length: 5 }, (_, i) => (
      <Skeleton key={i} className="h-5 w-full" />
    ))}
  </div>
);

const SwitcherSections: React.FC<{
  sections: NotebookSections;
  query: string;
  onSwitch: (item: NotebookItem) => void;
  onTogglePin: (item: NotebookItem) => void;
  onShutdown: (item: NotebookItem) => void;
  onReveal: () => void;
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
    return (
      <div className="flex flex-col items-start gap-2 p-3 text-xs text-muted-foreground">
        {query ? (
          <span>No notebooks match &ldquo;{query}&rdquo;.</span>
        ) : (
          <>
            <span>No notebooks in this project yet.</span>
            <Button variant="link" size="sm" onClick={onCreateNotebook}>
              Create your first notebook
            </Button>
          </>
        )}
      </div>
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

const SECTION_HEADER_CLASS =
  "px-3 py-1.5 text-[10px] font-mono font-medium uppercase tracking-[0.12em] text-muted-foreground";

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
  onReveal: () => void;
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
            className="flex items-center gap-1.5 px-3 pt-1.5 pb-0.5 text-[10px] text-muted-foreground/80"
          >
            <FolderIcon className="w-3 h-3" strokeWidth={1.5} />
            <span className="truncate">{item.directory}</span>
          </div>,
        );
      }
    }
    rows.push(
      <NotebookRow
        key={item.path}
        item={item}
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
  onSwitch: (item: NotebookItem) => void;
  onTogglePin: (item: NotebookItem) => void;
  onShutdown: (item: NotebookItem) => void;
  onReveal: () => void;
}> = ({ item, onSwitch, onTogglePin, onShutdown, onReveal }) => {
  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 h-6 pl-3 pr-1 text-xs cursor-pointer",
        "hover:bg-accent/50 hover:text-accent-foreground",
        item.isCurrent && "bg-muted/70",
      )}
      aria-current={item.isCurrent ? "true" : undefined}
      data-testid={`notebook-switcher-row-${item.path}`}
      onClick={() => onSwitch(item)}
    >
      <NotebookTextIcon
        className="w-3.5 h-3.5 shrink-0 text-muted-foreground"
        strokeWidth={1.5}
      />
      <span
        className={cn("flex-1 truncate", item.isCurrent && "font-medium")}
        title={item.path}
      >
        {item.name}
      </span>
      {item.isRunning && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0"
          title="Running"
          data-testid={`notebook-switcher-running-${item.path}`}
        />
      )}
      <FileActionsDropdown
        testId={`notebook-switcher-actions-${item.path}`}
        contentClassName="print:hidden w-[220px]"
      >
        <DropdownMenuItem onSelect={() => openNotebook(item.path)}>
          <ExternalLinkIcon className={MENU_ITEM_ICON_CLASS} />
          Open in new tab
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onReveal}>
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
