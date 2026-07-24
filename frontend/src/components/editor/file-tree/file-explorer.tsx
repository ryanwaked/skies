/* Copyright 2026 Marimo. All rights reserved. */

import { useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  ArrowLeftIcon,
  BetweenHorizontalStartIcon,
  BracesIcon,
  CopyMinusIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FilePlus2Icon,
  FolderPlusIcon,
  ListTreeIcon,
  NotebookPenIcon,
  PlaySquareIcon,
  UploadIcon,
  ViewIcon,
} from "lucide-react";
import React, { Suspense, use, useEffect, useRef, useState } from "react";
import {
  type NodeApi,
  type NodeRendererProps,
  Tree,
  type TreeApi,
} from "react-arborist";
import useEvent from "react-use-event-hook";
import {
  FILE_ICON,
  FILE_ICON_COLOR,
  type FileIconType,
  guessFileIconType,
} from "@/components/editor/file-tree/file-icons";
import {
  DeleteMenuItem,
  DuplicateMenuItem,
  FileActionsDropdown,
  RenameMenuItem,
} from "@/components/editor/file-tree/file-operations";
import { FileNameInput } from "@/components/editor/file-tree/file-name-input";
import {
  MENU_ITEM_ICON_CLASS,
  RefreshIconButton,
  TreeChevron,
  VisibilityToggleButton,
} from "@/components/editor/file-tree/tree-actions";
import { Spinner } from "@/components/icons/spinner";
import { useImperativeModal } from "@/components/modal/ImperativeModal";
import { AlertDialogDestructiveAction } from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { useCellActions } from "@/core/cells/cells";
import { useLastFocusedCellId } from "@/core/cells/focus";
import { disableFileDownloadsAtom } from "@/core/config/config";
import { useRequestClient } from "@/core/network/requests";
import type { FileInfo, MarimoFile } from "@/core/network/types";
import { isWasm } from "@/core/wasm/utils";
import { useAsyncData } from "@/hooks/useAsyncData";
import { ErrorBanner } from "@/plugins/impl/common/error-banner";
import { deserializeBlob } from "@/utils/blob";
import { cn } from "@/utils/cn";
import { copyToClipboard } from "@/utils/copy";
import { downloadBlob } from "@/utils/download";
import { type Base64String, base64ToDataURL } from "@/utils/json/base64";
import { openNotebook, openNotebookInCurrentTab } from "@/utils/links";
import { type FilePath, PathBuilder } from "@/utils/paths";
import { makeDuplicateName } from "@/utils/pathUtils";
import { jotaiJsonStorage } from "@/utils/storage/jotai";
import { useTreeDndManager } from "./dnd-wrapper";
import { FileViewer } from "./file-viewer";
import type { RequestingTree } from "./requesting-tree";
import { openStateAtom, revealPathAtom, treeAtom } from "./state";
import { PYTHON_CODE_FOR_FILE_TYPE } from "./types";
import { useFileExplorerUpload } from "./upload";

const hiddenFilesState = atomWithStorage(
  "marimo:showHiddenFiles",
  true,
  jotaiJsonStorage,
  {
    getOnInit: true,
  },
);

const RequestingTreeContext = React.createContext<RequestingTree | null>(null);

/**
 * Map of absolute file path -> session id for notebooks with a live kernel
 * session, so clicking a running notebook in the explorer warm-resumes its
 * existing session instead of spawning a new kernel.
 */
const RunningNotebookSessionsContext = React.createContext<
  ReadonlyMap<string, string>
>(new Map());

export const FileExplorer: React.FC<{
  height: number;
}> = ({ height }) => {
  const treeRef = useRef<TreeApi<FileInfo>>(null);
  const dndManager = useTreeDndManager();
  const [tree] = useAtom(treeAtom);
  const [data, setData] = useState<FileInfo[]>([]);
  const [openFile, setOpenFile] = useState<FileInfo | null>(null);
  const [showHiddenFiles, setShowHiddenFiles] =
    useAtom<boolean>(hiddenFilesState);

  const { openPrompt } = useImperativeModal();
  const { getRunningNotebooks } = useRequestClient();
  // Track running notebooks so clicks on a running notebook can warm-resume
  // its existing session (same-tab switch with `session_id`). Not supported
  // in WASM; a failure here is non-fatal and just skips warm-resume.
  const { data: runningNotebooks } = useAsyncData(
    () =>
      isWasm()
        ? Promise.resolve({ files: [] as MarimoFile[] })
        : getRunningNotebooks(),
    [],
  );
  const runningSessions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const file of runningNotebooks?.files ?? []) {
      if (file.sessionId) {
        map.set(file.path, file.sessionId);
      }
    }
    return map;
  }, [runningNotebooks]);
  // Keep external state to remember which folders are open
  // when this component is unmounted
  const [openState, setOpenState] = useAtom(openStateAtom);
  const { isPending, error } = useAsyncData(() => tree.initialize(setData), []);

  const handleRefresh = useEvent(() => {
    // Return the promise so callers can await refresh completion
    return tree.refreshAll(
      Object.keys(openState).filter((id) => openState[id]),
    );
  });

  const handleHiddenFilesToggle = useEvent(() => {
    const newValue = !showHiddenFiles;
    setShowHiddenFiles(newValue);
  });

  const handleCreateFolder = useEvent(async () => {
    openPrompt({
      title: "Folder name",
      onConfirm: async (name) => {
        tree.createFolder(name, null);
      },
    });
  });

  const handleCreateFile = useEvent(async () => {
    openPrompt({
      title: "File name",
      onConfirm: async (name) => {
        tree.createFile({ name, parentId: null });
      },
    });
  });

  const handleCreateNotebook = useEvent(async () => {
    openPrompt({
      title: "Notebook name",
      onConfirm: async (name) => {
        tree.createFile({ name, parentId: null, type: "notebook" });
      },
    });
  });

  const handleCollapseAll = useEvent(() => {
    treeRef.current?.closeAll();
    setOpenState({});
  });

  // Reveal a file requested from another panel (e.g. the notebook switcher):
  // expand its ancestor folders (fetching children as needed), then scroll
  // the row into view and focus it. The atom is cleared once consumed.
  const [revealPath, setRevealPath] = useAtom(revealPathAtom);
  useEffect(() => {
    if (!revealPath || isPending) {
      return;
    }
    let cancelled = false;
    const reveal = async () => {
      // Leave the file viewer (if open) so the tree is visible.
      setOpenFile(null);
      const builder = PathBuilder.guessDeliminator(revealPath);
      const relative = tree.relativeFromRoot(revealPath as FilePath);
      const depth = relative
        .split(builder.deliminator)
        .filter(Boolean).length;
      // Ancestor directories, topmost first, so each expand can fetch the
      // children the next one needs.
      const ancestors: string[] = [];
      let cursor = revealPath;
      for (let i = 0; i < depth - 1; i++) {
        cursor = builder.dirname(cursor as FilePath);
        ancestors.unshift(cursor);
      }
      const opened: Record<string, boolean> = {};
      for (const id of ancestors) {
        if (cancelled) {
          return;
        }
        await tree.expand(id);
        treeRef.current?.open(id);
        opened[id] = true;
      }
      if (cancelled) {
        return;
      }
      if (Object.keys(opened).length > 0) {
        setOpenState((prev) => ({ ...prev, ...opened }));
      }
      // Wait for the expanded rows to render before scrolling.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) {
            return;
          }
          treeRef.current?.scrollTo(revealPath);
          treeRef.current?.focus(revealPath);
        });
      });
      setRevealPath(null);
    };
    void reveal();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealPath, isPending, tree]);

  const visibleData = React.useMemo(
    () => filterHiddenTree(data, showHiddenFiles),
    [data, showHiddenFiles],
  );

  if (isPending) {
    return <Spinner size="medium" centered={true} />;
  }

  if (error) {
    return <ErrorBanner error={error} />;
  }

  if (openFile) {
    return (
      <>
        <div className="flex items-center h-[30px] pl-1 pr-3 shrink-0 border-b border-border justify-between">
          <Button
            onClick={() => setOpenFile(null)}
            data-testid="file-explorer-back-button"
            variant="text"
            size="xs"
            className="mb-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon size={14} strokeWidth={1.5} />
          </Button>
          <span className="text-sm font-medium text-foreground truncate">
            {openFile.name}
          </span>
        </div>
        <Suspense>
          <FileViewer
            onOpenNotebook={(evt) =>
              openMarimoNotebook({
                event: evt,
                path: tree.relativeFromRoot(openFile.path as FilePath),
                sessionId: findRunningSession(
                  runningSessions,
                  tree,
                  openFile.path,
                ),
              })
            }
            file={openFile}
          />
        </Suspense>
      </>
    );
  }

  return (
    <>
      <Toolbar
        onRefresh={handleRefresh}
        onHidden={handleHiddenFilesToggle}
        showHiddenFiles={showHiddenFiles}
        onCreateFile={handleCreateFile}
        onCreateNotebook={handleCreateNotebook}
        onCreateFolder={handleCreateFolder}
        onCollapseAll={handleCollapseAll}
        tree={tree}
      />
      <RequestingTreeContext value={tree}>
        <RunningNotebookSessionsContext value={runningSessions}>
          <Tree<FileInfo>
            width="100%"
            ref={treeRef}
            height={height - 33}
            className="h-full"
            data={visibleData}
            initialOpenState={openState}
            openByDefault={false}
            // Use shared DnD manager to prevent "Cannot have two HTML5 backends" error
            dndManager={dndManager}
            // Hide the drop cursor
            renderCursor={() => null}
            // Disable dropping files into files
            disableDrop={({ parentNode }) => !parentNode.data.isDirectory}
            onDelete={async ({ ids }) => {
              for (const id of ids) {
                await tree.delete(id);
              }
            }}
            onRename={async ({ id, name }) => {
              await tree.rename(id, name);
            }}
            onMove={async ({ dragIds, parentId }) => {
              await tree.move(dragIds, parentId);
            }}
            onSelect={(nodes) => {
              const first = nodes[0];
              if (!first) {
                return;
              }
              if (!first.data.isDirectory) {
                setOpenFile(first.data);
              }
            }}
            onToggle={async (id) => {
              const result = await tree.expand(id);
              if (result) {
                const prevOpen = openState[id] ?? false;
                setOpenState({ ...openState, [id]: !prevOpen });
              }
            }}
            padding={15}
            rowHeight={26}
            indent={INDENT_STEP}
            overscanCount={1000}
            // Disable multi-selection
            disableMultiSelection={true}
          >
            {Node}
          </Tree>
        </RunningNotebookSessionsContext>
      </RequestingTreeContext>
    </>
  );
};

const INDENT_STEP = 12;

interface ToolbarProps {
  onRefresh: () => void;
  onHidden: () => void;
  showHiddenFiles: boolean;
  onCreateFile: () => void;
  onCreateNotebook: () => void;
  onCreateFolder: () => void;
  onCollapseAll: () => void;
  tree: RequestingTree;
}

const Toolbar = ({
  onRefresh,
  onHidden,
  showHiddenFiles,
  onCreateFile,
  onCreateNotebook,
  onCreateFolder,
  onCollapseAll,
}: ToolbarProps) => {
  const { getRootProps, getInputProps } = useFileExplorerUpload({
    noDrag: true,
    noDragEventsBubbling: true,
  });

  const ghostIconButton = "text-muted-foreground hover:text-foreground";

  return (
    <div className="flex items-center justify-end h-[30px] px-2 shrink-0 border-b border-border">
      <Tooltip content="Add notebook">
        <Button
          data-testid="file-explorer-add-notebook-button"
          onClick={onCreateNotebook}
          variant="text"
          size="xs"
          className={ghostIconButton}
        >
          <NotebookPenIcon size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
      <Tooltip content="Add file">
        <Button
          data-testid="file-explorer-add-file-button"
          onClick={onCreateFile}
          variant="text"
          size="xs"
          className={ghostIconButton}
        >
          <FilePlus2Icon size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
      <Tooltip content="Add folder">
        <Button
          data-testid="file-explorer-add-folder-button"
          onClick={onCreateFolder}
          variant="text"
          size="xs"
          className={ghostIconButton}
        >
          <FolderPlusIcon size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
      <Tooltip content="Upload file">
        <button
          data-testid="file-explorer-upload-button"
          {...getRootProps({})}
          className={cn(
            buttonVariants({
              variant: "text",
              size: "xs",
            }),
            ghostIconButton,
          )}
        >
          <UploadIcon size={14} strokeWidth={1.5} />
        </button>
      </Tooltip>
      <input {...getInputProps({})} type="file" />
      <RefreshIconButton
        data-testid="file-explorer-refresh-button"
        onClick={onRefresh}
        className={ghostIconButton}
      />
      <VisibilityToggleButton
        data-testid="file-explorer-hidden-files-button"
        isVisible={showHiddenFiles}
        onToggle={onHidden}
        showTooltip="Show hidden files"
        hideTooltip="Hide hidden files"
        className={ghostIconButton}
      />
      <Tooltip content="Collapse all folders">
        <Button
          data-testid="file-explorer-collapse-button"
          onClick={onCollapseAll}
          variant="text"
          size="xs"
          className={ghostIconButton}
        >
          <CopyMinusIcon size={14} strokeWidth={1.5} />
        </Button>
      </Tooltip>
    </div>
  );
};

const Show = ({
  node,
  onOpenMarimoFile,
}: {
  node: NodeApi<FileInfo>;
  onOpenMarimoFile: (
    evt: Pick<Event, "stopPropagation" | "preventDefault">,
  ) => void;
}) => {
  return (
    <span
      className="flex-1 overflow-hidden text-ellipsis"
      onClick={(e) => {
        if (node.data.isDirectory) {
          return;
        }
        e.stopPropagation();
        node.select();
      }}
    >
      {node.data.name}
      {node.data.isMarimoFile && !isWasm() && (
        <span
          data-testid="file-explorer-open-marimo-button"
          className="shrink-0 ml-2 text-xs text-primary hidden group-hover:inline hover:underline"
          onClick={onOpenMarimoFile}
        >
          open
        </span>
      )}
    </span>
  );
};

const Node = ({ node, style, dragHandle }: NodeRendererProps<FileInfo>) => {
  const { openFile, sendFileDetails } = useRequestClient();
  const disableFileDownloads = useAtomValue(disableFileDownloadsAtom);

  const fileType: FileIconType = node.data.isDirectory
    ? "directory"
    : guessFileIconType(node.data.name);

  const Icon = FILE_ICON[fileType];
  const { openConfirm, openPrompt } = useImperativeModal();
  const { createNewCell } = useCellActions();
  const lastFocusedCellId = useLastFocusedCellId();

  const handleInsertCode = (code: string) => {
    createNewCell({
      code,
      before: false,
      cellId: lastFocusedCellId ?? "__end__",
    });
  };

  const tree = use(RequestingTreeContext);
  const runningSessions = use(RunningNotebookSessionsContext);

  const handleOpenMarimoFile = async (
    evt: Pick<Event, "stopPropagation" | "preventDefault">,
  ) => {
    const path = tree
      ? tree.relativeFromRoot(node.data.path as FilePath)
      : node.data.path;
    // Warm-resume the existing kernel session when this notebook is running.
    openMarimoNotebook({
      event: evt,
      path,
      sessionId: findRunningSession(runningSessions, tree, node.data.path),
    });
  };

  const handleOpenMarimoFileInNewTab = (
    evt: Pick<Event, "stopPropagation" | "preventDefault">,
  ) => {
    evt.stopPropagation();
    evt.preventDefault();
    const path = tree
      ? tree.relativeFromRoot(node.data.path as FilePath)
      : node.data.path;
    openNotebook(path);
  };

  const handleDeleteFile = async (evt: Event) => {
    evt.stopPropagation();
    evt.preventDefault();
    openConfirm({
      title: "Delete file",
      description: `Are you sure you want to delete ${node.data.name}?`,
      confirmAction: (
        <AlertDialogDestructiveAction
          onClick={async () => {
            await node.tree.delete(node.id);
          }}
          aria-label="Confirm"
        >
          Delete
        </AlertDialogDestructiveAction>
      ),
    });
  };

  const handleCreateFolder = useEvent(async () => {
    // If not expanded, then expand
    node.open();
    openPrompt({
      title: "Folder name",
      onConfirm: async (name) => {
        tree?.createFolder(name, node.id);
      },
    });
  });

  const handleCreateFile = useEvent(async () => {
    node.open();
    openPrompt({
      title: "File name",
      onConfirm: async (name) => {
        tree?.createFile({ name, parentId: node.id });
      },
    });
  });

  const handleCreateNotebook = useEvent(async () => {
    node.open();
    openPrompt({
      title: "Notebook name",
      onConfirm: async (name) => {
        tree?.createFile({ name, parentId: node.id, type: "notebook" });
      },
    });
  });

  const handleDuplicate = useEvent(async () => {
    if (!tree) {
      return;
    }
    await tree.copy(node.id, makeDuplicateName(node.data.name));
  });

  return (
    <div
      style={style}
      ref={dragHandle}
      className={cn(
        "flex items-center cursor-pointer ml-1 text-muted-foreground whitespace-nowrap group",
      )}
      draggable={true}
      onClick={(evt) => {
        evt.stopPropagation();
        if (node.data.isDirectory) {
          node.toggle();
        }
      }}
    >
      <FolderArrow node={node} />
      <span
        className={cn(
          "flex items-center pl-1 py-0.5 cursor-pointer text-[13px] rounded-[3px] flex-1 overflow-hidden group",
          node.isSelected
            ? "bg-primary/[0.07] text-primary"
            : "hover:bg-[var(--hover-wash)] hover:text-foreground",
          node.willReceiveDrop &&
            node.data.isDirectory &&
            "bg-primary/[0.07] hover:bg-primary/[0.07] text-primary hover:text-primary",
        )}
      >
        {node.data.isMarimoFile ? (
          <NotebookPenIcon
            className="w-4 h-4 shrink-0 mr-1.5 text-primary"
            strokeWidth={1.5}
          />
        ) : (
          <Icon
            className={cn(
              "w-4 h-4 shrink-0 mr-1.5",
              node.isSelected ? "text-primary" : FILE_ICON_COLOR[fileType],
            )}
            strokeWidth={1.5}
          />
        )}
        {node.isEditing ? (
          <FileNameInput node={node} />
        ) : (
          <Show node={node} onOpenMarimoFile={handleOpenMarimoFile} />
        )}
        <FileActionsDropdown
          testId="file-explorer-more-button"
          iconClassName="w-4 h-4"
        >
          {!node.data.isDirectory && (
            <DropdownMenuItem
              onSelect={() => node.select()}
              data-testid="file-explorer-open-file-menu-item"
            >
              <ViewIcon className={MENU_ITEM_ICON_CLASS} />
              Open file
            </DropdownMenuItem>
          )}
          {!node.data.isDirectory && !isWasm() && (
            <DropdownMenuItem
              onSelect={() => {
                openFile({ path: node.data.path });
              }}
              data-testid="file-explorer-open-external-menu-item"
            >
              <ExternalLinkIcon className={MENU_ITEM_ICON_CLASS} />
              Open file in external editor
            </DropdownMenuItem>
          )}
          {node.data.isDirectory && (
            <>
              <DropdownMenuItem
                onSelect={() => handleCreateNotebook()}
                data-testid="file-explorer-create-notebook-menu-item"
              >
                <NotebookPenIcon className={MENU_ITEM_ICON_CLASS} />
                Create notebook
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => handleCreateFile()}
                data-testid="file-explorer-create-file-menu-item"
              >
                <FilePlus2Icon className={MENU_ITEM_ICON_CLASS} />
                Create file
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => handleCreateFolder()}
                data-testid="file-explorer-create-folder-menu-item"
              >
                <FolderPlusIcon className={MENU_ITEM_ICON_CLASS} />
                Create folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <RenameMenuItem
            onSelect={() => node.edit()}
            testId="file-explorer-rename-menu-item"
          />
          <DuplicateMenuItem
            onSelect={handleDuplicate}
            testId="file-explorer-duplicate-menu-item"
          />
          <DropdownMenuItem
            onSelect={async () => {
              await copyToClipboard(node.data.path);
              toast({ title: "Copied to clipboard" });
            }}
            data-testid="file-explorer-copy-path-menu-item"
          >
            <ListTreeIcon className={MENU_ITEM_ICON_CLASS} />
            Copy path
          </DropdownMenuItem>
          {tree && (
            <DropdownMenuItem
              onSelect={async () => {
                await copyToClipboard(
                  tree.relativeFromRoot(node.data.path as FilePath),
                );
                toast({ title: "Copied to clipboard" });
              }}
              data-testid="file-explorer-copy-relative-path-menu-item"
            >
              <ListTreeIcon className={MENU_ITEM_ICON_CLASS} />
              Copy relative path
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              const { path } = node.data;
              const pythonCode = PYTHON_CODE_FOR_FILE_TYPE[fileType](path);
              handleInsertCode(pythonCode);
            }}
            data-testid="file-explorer-insert-snippet-menu-item"
          >
            <BetweenHorizontalStartIcon className={MENU_ITEM_ICON_CLASS} />
            Insert snippet for reading file
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={async () => {
              toast({
                title: "Copied to clipboard",
                description:
                  "Code to open the file has been copied to your clipboard. You can also drag and drop this file into the editor",
              });
              const { path } = node.data;
              const pythonCode = PYTHON_CODE_FOR_FILE_TYPE[fileType](path);
              await copyToClipboard(pythonCode);
            }}
            data-testid="file-explorer-copy-snippet-menu-item"
          >
            <BracesIcon className={MENU_ITEM_ICON_CLASS} />
            Copy snippet for reading file
          </DropdownMenuItem>
          {node.data.isMarimoFile && !isWasm() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleOpenMarimoFile}
                data-testid="file-explorer-open-notebook-menu-item"
              >
                <PlaySquareIcon className={MENU_ITEM_ICON_CLASS} />
                Open notebook
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={handleOpenMarimoFileInNewTab}
                data-testid="file-explorer-open-notebook-new-tab-menu-item"
              >
                <ExternalLinkIcon className={MENU_ITEM_ICON_CLASS} />
                Open notebook in new tab
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          {!node.data.isDirectory && !disableFileDownloads && (
            <>
              <DropdownMenuItem
                onSelect={async () => {
                  const details = await sendFileDetails({
                    path: node.data.path,
                  });
                  if (details.isBase64 && details.contents) {
                    const blob = deserializeBlob(
                      base64ToDataURL(
                        details.contents as Base64String,
                        details.mimeType || "application/octet-stream",
                      ),
                    );
                    downloadBlob(blob, node.data.name);
                  } else {
                    downloadBlob(
                      new Blob([details.contents || ""]),
                      node.data.name,
                    );
                  }
                }}
                data-testid="file-explorer-download-menu-item"
              >
                <DownloadIcon className={MENU_ITEM_ICON_CLASS} />
                Download
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DeleteMenuItem
            onSelect={handleDeleteFile}
            testId="file-explorer-delete-menu-item"
          />
        </FileActionsDropdown>
      </span>
    </div>
  );
};

const FolderArrow = ({ node }: { node: NodeApi<FileInfo> }) => {
  if (!node.data.isDirectory) {
    return <span className="w-3.5 h-3.5 shrink-0" />;
  }

  return <TreeChevron isExpanded={node.isOpen} className="w-3.5 h-3.5" />;
};

function openMarimoNotebook(opts: {
  event: Pick<Event, "stopPropagation" | "preventDefault">;
  path: string;
  sessionId?: string;
}) {
  const { event, path, sessionId } = opts;
  event.stopPropagation();
  event.preventDefault();
  // Switch notebooks in the same tab; pass the session id of a running
  // notebook so its kernel session is warm-resumed.
  openNotebookInCurrentTab(path, sessionId);
}

/**
 * Look up the running session for an explorer file. The running-notebooks
 * endpoint keys files by workspace-relative "pretty" paths, while explorer
 * nodes carry absolute paths, so try the root-relative form first and fall
 * back to the raw path (absolute when the file lives outside the workspace).
 */
export function findRunningSession(
  runningSessions: ReadonlyMap<string, string>,
  tree: RequestingTree | null,
  path: string,
): string | undefined {
  if (tree) {
    const relative = tree.relativeFromRoot(path as FilePath);
    const sessionId = runningSessions.get(relative);
    if (sessionId) {
      return sessionId;
    }
  }
  return runningSessions.get(path);
}

export function filterHiddenTree(
  list: FileInfo[],
  showHidden: boolean,
): FileInfo[] {
  if (showHidden) {
    return list;
  }

  const out: FileInfo[] = [];
  for (const item of list) {
    if (isDirectoryOrFileHidden(item.name)) {
      continue;
    }
    let next = item;
    if (item.children) {
      const kids = filterHiddenTree(item.children, showHidden);
      if (kids !== item.children) {
        next = { ...item, children: kids };
      }
    }
    out.push(next);
  }
  return out;
}

export function isDirectoryOrFileHidden(filename: string): boolean {
  if (filename.startsWith(".")) {
    return true;
  }
  return false;
}
