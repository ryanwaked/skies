/* Copyright 2026 Marimo. All rights reserved. */

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  ArrowUpRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsDownUpIcon,
  PlusIcon,
  RefreshCcwIcon,
  SearchIcon,
} from "lucide-react";
import type React from "react";
import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import {
  type NodeApi,
  type NodeRendererProps,
  Tree,
  type TreeApi,
} from "react-arborist";
import { useLocale } from "react-aria";
import useEvent from "react-use-event-hook";
import { MarkdownIcon } from "@/components/editor/cell/code/icons";
import {
  FILE_ICON as FILE_TYPE_ICONS,
  type FileIconType as FileType,
  guessFileIconType as guessFileType,
} from "@/components/editor/file-tree/file-icons";
import { FileNameInput } from "@/components/editor/file-tree/file-name-input";
import {
  DeleteMenuItem,
  DuplicateMenuItem,
  FileActionsDropdown,
  RenameMenuItem,
  useFileOperations,
  useNotebookFileActions,
} from "@/components/editor/file-tree/file-operations";
import { PageSky } from "@/components/skies/page-sky";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { assignedPaths, collectionsAtom } from "@/core/home/collections";
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
  CollectionMenuItems,
  excludeAssignedFiles,
  HomeCollections,
  SectionLabel,
} from "../home/collections";
import {
  Header,
  OpenTutorialDropDown,
  ResourceLinks,
} from "../home/components";
import {
  NOTEBOOK_ROW_ITEM_CLASS,
  NotebookRowLink,
  relativeToRoot,
  SessionShutdownButton,
  tabTarget,
} from "../home/notebook-row";
import {
  expandedFoldersAtom,
  includeMarkdownAtom,
  RunningNotebooksContext,
  WorkspaceContext,
} from "../home/state";
import { Spinner } from "../icons/spinner";
import { Input } from "../ui/input";

const HomePage: React.FC = () => {
  const [nonce, setNonce] = useState(0);
  const { getRecentFiles, getRunningNotebooks } = useRequestClient();

  const recentsResponse = useAsyncData(() => getRecentFiles(), []);

  useInterval(
    () => {
      setNonce((nonce) => nonce + 1);
    },
    // Refresh every 10 seconds, or when the document becomes visible
    { delayMs: 10_000, whenVisible: true },
  );

  const runningResponse = useAsyncData(async () => {
    const response = await getRunningNotebooks();
    return Maps.keyBy(response.files, (file) => file.path);
  }, [nonce]);

  const response = combineAsyncData(recentsResponse, runningResponse);

  if (response.error) {
    throw response.error;
  }

  const data = response.data;
  if (!data) {
    return <Spinner centered={true} size="xlarge" />;
  }

  const [recents, running] = data;

  return (
    <Suspense>
      <RunningNotebooksContext
        value={{
          runningNotebooks: running,
          setRunningNotebooks: runningResponse.setData,
        }}
      >
        <PageSky />
        <div className="skies-over-sky absolute top-3 right-5 flex gap-3 z-50 max-sm:static max-sm:justify-end max-sm:mx-5 max-sm:mt-3">
          <OpenTutorialDropDown />
          <ConfigButton showAppConfig={false} />
          <ShutdownButton
            description={`This will shutdown the notebook server and terminate all running notebooks (${running.size}). You'll lose all data that's in memory.`}
          />
        </div>
        <div className="flex flex-col gap-9 max-w-5xl container pt-6 pb-24 z-10">
          <header className="skies-hero mb-4">
            <p className="skies-kicker">skies — reactive notebooks</p>
            <h1 className="skies-hero-title">Notebooks</h1>
            <div className="skies-hero-meta">
              {running.size > 0 && (
                <span className="skies-status">
                  <i className="skies-status__dot skies-ping" />
                  {running.size} running
                </span>
              )}
              <span>{recents.files.length} recent</span>
              <span className="dot">·</span>
              <span>reactive python, on the desk</span>
            </div>
            <div className="mt-5">
              <a
                className="skies-cta"
                href={newNotebookURL().toString()}
                target="_blank"
                rel="noreferrer"
              >
                <PlusIcon size={14} strokeWidth={2} />
                new notebook
              </a>
            </div>
          </header>
          <NotebookList
            label="running now"
            live={true}
            files={[...running.values()]}
          />
          <NotebookList label="recent notebooks" files={recents.files} />
          <ErrorBoundary>
            <WorkspaceNotebooks onRefreshRecents={recentsResponse.refetch} />
          </ErrorBoundary>
          <ResourceLinks />
        </div>
      </RunningNotebooksContext>
    </Suspense>
  );
};

const WorkspaceNotebooks: React.FC<{ onRefreshRecents: () => void }> = ({
  onRefreshRecents,
}) => {
  const { getWorkspaceFiles } = useRequestClient();
  const [includeMarkdown, setIncludeMarkdown] = useAtom(includeMarkdownAtom);
  const [searchText, setSearchText] = useState("");
  const {
    isPending,
    data: workspace,
    error,
    isFetching,
    refetch,
  } = useAsyncData(
    () => getWorkspaceFiles({ includeMarkdown }),
    [includeMarkdown],
  );

  // Fire-and-forget refresh of both the workspace tree and the "Recent
  // notebooks" list — file mutations on the workspace tree can affect both,
  // so we invalidate them together rather than having two refresh triggers.
  const refreshWorkspace = useEvent(() => {
    refetch();
    onRefreshRecents();
  });

  const workspaceContextValue = useMemo(
    () => ({ root: workspace?.root ?? "", refreshWorkspace }),
    [workspace?.root, refreshWorkspace],
  );

  if (isPending) {
    return <Spinner centered={true} size="xlarge" className="mt-6" />;
  }

  if (error) {
    return (
      <Banner kind="danger" className="rounded p-4">
        {prettyError(error)}
      </Banner>
    );
  }

  return (
    <WorkspaceContext value={workspaceContextValue}>
      <div className="flex flex-col gap-2">
        {workspace.hasMore && (
          <Banner kind="warn" className="rounded p-4">
            Showing first {workspace.fileCount} files. Your workspace has more
            files.
          </Banner>
        )}
        <Header
          control={
            <div className="flex items-center gap-2">
              <Input
                id="search"
                value={searchText}
                icon={<SearchIcon size={13} />}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search"
                className="mb-0 border-border"
              />
              <CollapseAllButton />
              <Checkbox
                data-testid="include-markdown-checkbox"
                id="include-markdown"
                checked={includeMarkdown}
                onCheckedChange={(checked) =>
                  setIncludeMarkdown(Boolean(checked))
                }
              />
              <Label htmlFor="include-markdown">Include markdown</Label>
              <Button
                variant="text"
                size="icon"
                className="w-4 h-4 p-0 opacity-70 hover:opacity-100"
                onClick={() => refetch()}
                aria-label="Refresh workspace"
              >
                <RefreshCcwIcon className="w-4 h-4" />
              </Button>
              {isFetching && <Spinner size="small" />}
            </div>
          }
        >
          workspace
        </Header>
        <HomeCollections files={workspace.files} searchText={searchText} />
        <SectionLabel>All notebooks</SectionLabel>
        <div className="skies-paper flex flex-col divide-y divide-border overflow-hidden max-h-192 overflow-y-auto text-[13px]">
          <UngroupedNotebookFileTree
            searchText={searchText}
            files={workspace.files}
          />
        </div>
      </div>
    </WorkspaceContext>
  );
};

/**
 * The workspace file tree, minus any notebooks assigned to a collection
 * (those render inside their collection's section above).
 */
const UngroupedNotebookFileTree: React.FC<{
  files: FileInfo[];
  searchText?: string;
}> = ({ files, searchText }) => {
  const collections = useAtomValue(collectionsAtom);
  const ungroupedFiles = useMemo(
    () => excludeAssignedFiles(files, assignedPaths(collections)),
    [files, collections],
  );
  return <NotebookFileTree searchText={searchText} files={ungroupedFiles} />;
};

const CollapseAllButton: React.FC = () => {
  const setOpenState = useSetAtom(expandedFoldersAtom);
  return (
    <Button
      variant="text"
      size="sm"
      className="h-fit hidden sm:flex"
      onClick={() => {
        setOpenState({});
      }}
    >
      <ChevronsDownUpIcon className="w-4 h-4 mr-1" />
      Collapse all
    </Button>
  );
};

const NotebookFileTree: React.FC<{
  files: FileInfo[];
  searchText?: string;
}> = ({ files, searchText }) => {
  const [openState, setOpenState] = useAtom(expandedFoldersAtom);
  const openStateIsEmpty = Object.keys(openState).length === 0;
  const ref = useRef<TreeApi<FileInfo>>(undefined);
  const { root, refreshWorkspace } = use(WorkspaceContext);
  const { renameFile } = useFileOperations({ root });

  useEffect(() => {
    // If empty, collapse all
    if (openStateIsEmpty) {
      ref.current?.closeAll();
    }
  }, [openStateIsEmpty]);

  const handleRename = useEvent(async (id: string, name: string) => {
    const node = ref.current?.get(id);
    if (!node) {
      toast({
        title: "Failed",
        description: `Node with id ${id} not found in the tree`,
      });
      return;
    }
    const result = await renameFile(node.data, name);
    if (result) {
      refreshWorkspace();
    }
  });

  if (files.length === 0) {
    return (
      <div className="flex flex-col px-5 py-10 items-center justify-center">
        <p className="text-center text-muted-foreground">
          No files in this workspace
        </p>
      </div>
    );
  }

  return (
    <Tree<FileInfo>
      ref={ref}
      width="100%"
      // Size the paper to its contents for small workspaces (folders that
      // expand past the cap scroll inside the panel).
      height={Math.min(500, Math.max(140, files.length * 26 + 16))}
      searchTerm={searchText}
      className="h-full"
      idAccessor={(data) => data.path}
      data={files}
      openByDefault={false}
      initialOpenState={openState}
      onToggle={async (id) => {
        const prevOpen = openState[id] ?? false;
        setOpenState({ ...openState, [id]: !prevOpen });
      }}
      onRename={async ({ id, name }) => {
        await handleRename(id, name);
      }}
      padding={5}
      rowHeight={26}
      indent={15}
      overscanCount={1000}
      // Hide the drop cursor
      renderCursor={() => null}
      // Disable interactions
      disableDrop={true}
      disableDrag={true}
      disableMultiSelection={true}
    >
      {Node}
    </Tree>
  );
};

const Node = ({ node, style }: NodeRendererProps<FileInfo>) => {
  const fileType: FileType = node.data.isDirectory
    ? "directory"
    : guessFileType(node.data.name);

  const Icon = FILE_TYPE_ICONS[fileType];
  const iconEl = <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />;
  const { root } = use(WorkspaceContext);
  const { runningNotebooks } = use(RunningNotebooksContext);

  const renderItem = () => {
    // Inline rename input; react-arborist flips `node.isEditing` when
    // `node.edit()` is called from the FileActions menu.
    if (node.isEditing) {
      return (
        <div className={NOTEBOOK_ROW_ITEM_CLASS}>
          {iconEl}
          <FileNameInput node={node} />
        </div>
      );
    }

    if (node.data.isDirectory) {
      return (
        <span className={NOTEBOOK_ROW_ITEM_CLASS}>
          {iconEl}
          {node.data.name}
        </span>
      );
    }

    const relativePath = relativeToRoot(node.data.path, root);
    const isRunning = runningNotebooks.has(relativePath);

    return (
      <NotebookRowLink
        relativePath={relativePath}
        name={node.data.name}
        icon={iconEl}
        actions={<FileActions node={node} isRunning={isRunning} />}
      />
    );
  };

  return (
    <div
      style={style}
      className={cn(
        "flex items-center cursor-pointer ml-1 text-muted-foreground whitespace-nowrap group h-full",
      )}
      onClick={(evt) => {
        evt.stopPropagation();
        if (node.data.isDirectory) {
          node.toggle();
        }
      }}
    >
      <FolderArrow node={node} />
      {renderItem()}
    </div>
  );
};

const FileActions = ({
  node,
  isRunning,
}: {
  node: NodeApi<FileInfo>;
  isRunning: boolean;
}) => {
  const { root, refreshWorkspace } = use(WorkspaceContext);
  const { handleRename, handleDuplicate, handleDelete } =
    useNotebookFileActions({ node, root, onAfterChange: refreshWorkspace });

  const lockedReason = isRunning
    ? "Stop the notebook's kernel before renaming or deleting."
    : undefined;

  return (
    <FileActionsDropdown
      testId="workspace-more-button"
      buttonClassName="w-8 h-8 p-0 shrink-0"
      contentClassName="print:hidden w-fit min-w-[140px]"
      preventDefaultOnTrigger={true}
    >
      <RenameMenuItem
        onSelect={handleRename}
        disabled={isRunning}
        title={lockedReason}
      />
      <DuplicateMenuItem onSelect={handleDuplicate} />
      <CollectionMenuItems path={node.data.path} leadingSeparator={true} />
      <DropdownMenuSeparator />
      <DeleteMenuItem
        onSelect={handleDelete}
        disabled={isRunning}
        title={lockedReason}
      />
    </FileActionsDropdown>
  );
};

const FolderArrow = ({ node }: { node: NodeApi<FileInfo> }) => {
  if (!node.data.isDirectory) {
    return <span className="w-4 h-4 shrink-0" />;
  }

  return node.isOpen ? (
    <ChevronDownIcon className="w-4 h-4 shrink-0" />
  ) : (
    <ChevronRightIcon className="w-4 h-4 shrink-0" />
  );
};

/**
 * A corner-ticked paper panel holding notebook rows, with the site's mono
 * meta strip across the top (label left, count — and a live pill — right).
 */
const NotebookList: React.FC<{
  label: string;
  live?: boolean;
  files: MarimoFile[];
}> = ({ label, live, files }) => {
  if (files.length === 0) {
    return null;
  }

  return (
    <section className="skies-paper skies-ticks">
      <div className="skies-paper-meta">
        <span>{label}</span>
        {live ? (
          <span className="skies-status">
            <i className="skies-status__dot skies-ping" />
            {files.length} live
          </span>
        ) : (
          <span>{files.length}</span>
        )}
      </div>
      <div className="flex flex-col divide-y divide-border max-h-192 overflow-y-auto">
        {files.map((file) => {
          return <MarimoFileComponent key={file.path} file={file} />;
        })}
      </div>
    </section>
  );
};

const MarimoFileComponent = ({ file }: { file: MarimoFile }) => {
  const { locale } = useLocale();
  const { runningNotebooks } = use(RunningNotebooksContext);

  // If path is a sessionId, then it has not been saved yet
  // We want to keep the sessionId in this case
  const isNewNotebook = isSessionId(file.path);
  const href = isNewNotebook
    ? asURL(
        `?file=${encodeURIComponent(file.initializationId ?? file.path)}&session_id=${file.path}`,
      )
    : asURL(`?file=${encodeURIComponent(file.path)}`);

  const isMarkdown = file.path.endsWith(".md");
  const isRunning = runningNotebooks.has(file.path);

  return (
    <a
      className="py-3 px-4 hover:bg-muted transition-colors cursor-pointer group relative flex gap-4 items-center"
      key={file.path}
      href={href.toString()}
      target={tabTarget(file.initializationId || file.path)}
    >
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          {file.name}
          {isMarkdown && (
            <span className="opacity-80">
              <MarkdownIcon />
            </span>
          )}
          {isRunning && (
            <span className="skies-status">
              <i className="skies-status__dot skies-ping" />
              live
            </span>
          )}
        </span>
        <p
          title={file.path}
          className="font-mono text-[10.5px] tracking-[0.02em] text-[var(--foreground-dim)] overflow-hidden whitespace-nowrap text-ellipsis"
        >
          {file.path}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {!!file.lastModified && (
          <span className="font-mono text-[10.5px] text-[var(--foreground-dim)]">
            {timeAgo(file.lastModified * 1000, locale)}
          </span>
        )}
        <SessionShutdownButton filePath={file.path} />
        <ArrowUpRightIcon
          size={15}
          strokeWidth={1.5}
          className="text-[var(--foreground-dim)] transition-transform group-hover:translate-x-[2px] group-hover:-translate-y-[2px] group-hover:text-foreground"
        />
      </div>
    </a>
  );
};

export default HomePage;
