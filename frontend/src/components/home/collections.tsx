/* Copyright 2026 Marimo. All rights reserved. */

import { useAtom } from "jotai";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  Edit3Icon,
  FolderMinusIcon,
  FolderPlusIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import type React from "react";
import { use, useMemo, useRef, useState } from "react";
import {
  FILE_ICON as FILE_TYPE_ICONS,
  guessFileIconType as guessFileType,
} from "@/components/editor/file-tree/file-icons";
import { FileActionsDropdown } from "@/components/editor/file-tree/file-operations";
import { MENU_ITEM_ICON_CLASS } from "@/components/editor/file-tree/tree-actions";
import { useImperativeModal } from "@/components/modal/ImperativeModal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addPathToCollection,
  collectionContainingPath,
  collectionsAtom,
  createCollection,
  deleteCollection,
  type NotebookCollection,
  removePathFromCollections,
  renameCollection,
  toggleCollectionCollapsed,
} from "@/core/home/collections";
import type { FileInfo } from "@/core/network/types";
import { NotebookRowLink, relativeToRoot } from "./notebook-row";
import { WorkspaceContext } from "./state";

/**
 * Skies mono label voice: 10px JetBrains Mono uppercase, letterspaced,
 * muted — matching the sidebar panel headers.
 */
export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--foreground-dim)] select-none">
    {children}
  </h3>
);

/** Flatten the workspace file tree into a path -> file lookup (files only). */
function flattenFiles(files: FileInfo[]): Map<string, FileInfo> {
  const byPath = new Map<string, FileInfo>();
  const visit = (items: FileInfo[]) => {
    for (const item of items) {
      if (item.isDirectory) {
        visit(item.children ?? []);
      } else {
        byPath.set(item.path, item);
      }
    }
  };
  visit(files);
  return byPath;
}

/**
 * Remove files assigned to a collection from the workspace tree so they only
 * appear inside their collection's section. Directories are kept in place.
 */
export function excludeAssignedFiles(
  files: FileInfo[],
  assigned: Set<string>,
): FileInfo[] {
  if (assigned.size === 0) {
    return files;
  }
  return files
    .filter((file) => file.isDirectory || !assigned.has(file.path))
    .map((file) =>
      file.isDirectory && file.children
        ? { ...file, children: excludeAssignedFiles(file.children, assigned) }
        : file,
    );
}

/**
 * Collection sections for the home page: a "Collections" label with a
 * "+ New collection" ghost button, followed by one collapsible group per
 * collection. Rendered above the workspace ("All notebooks") file tree.
 */
export const HomeCollections: React.FC<{
  files: FileInfo[];
  searchText?: string;
}> = ({ files, searchText }) => {
  const [state, setState] = useAtom(collectionsAtom);
  // The collection whose name is currently being edited inline.
  const [editingId, setEditingId] = useState<string | null>(null);
  const byPath = useMemo(() => flattenFiles(files), [files]);

  const handleNewCollection = () => {
    const { state: next, id } = createCollection(state, "New collection");
    setState(next);
    setEditingId(id);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <SectionLabel>Collections</SectionLabel>
        <Button
          variant="text"
          size="xs"
          data-testid="new-collection-button"
          className="h-6 px-1.5 gap-1 text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-[var(--hover-wash)] rounded-[3px]"
          onClick={handleNewCollection}
        >
          <PlusIcon strokeWidth={1.5} className="w-3.5 h-3.5" />
          New collection
        </Button>
      </div>
      {state.collections.map((collection) => (
        <CollectionGroup
          key={collection.id}
          collection={collection}
          byPath={byPath}
          searchText={searchText}
          isEditing={editingId === collection.id}
          onStartEditing={() => setEditingId(collection.id)}
          onStopEditing={() => setEditingId(null)}
        />
      ))}
    </div>
  );
};

const CollectionGroup: React.FC<{
  collection: NotebookCollection;
  byPath: Map<string, FileInfo>;
  searchText?: string;
  isEditing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
}> = ({
  collection,
  byPath,
  searchText,
  isEditing,
  onStartEditing,
  onStopEditing,
}) => {
  const [, setState] = useAtom(collectionsAtom);
  const { root } = use(WorkspaceContext);

  // Only render files that still exist in the workspace; stale paths are
  // kept in storage (the file may reappear) but hidden from the UI.
  const collectionFiles = collection.filePaths.flatMap((path) => {
    const file = byPath.get(path);
    return file ? [file] : [];
  });

  const query = searchText?.trim().toLowerCase() ?? "";
  const visibleFiles = query
    ? collectionFiles.filter(
        (file) =>
          file.name.toLowerCase().includes(query) ||
          file.path.toLowerCase().includes(query),
      )
    : collectionFiles;

  // While searching, hide collections with no matches.
  if (query && visibleFiles.length === 0) {
    return null;
  }

  const collapsed = collection.collapsed ?? false;
  const ChevronIcon = collapsed ? ChevronRightIcon : ChevronDownIcon;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 group">
        <Button
          variant="text"
          size="icon"
          className="w-5 h-5 p-0 mb-0 text-muted-foreground hover:text-foreground"
          aria-label={collapsed ? "Expand collection" : "Collapse collection"}
          aria-expanded={!collapsed}
          onClick={() =>
            setState((s) => toggleCollectionCollapsed(s, collection.id))
          }
        >
          <ChevronIcon strokeWidth={1.5} className="w-3.5 h-3.5" />
        </Button>
        {isEditing ? (
          <CollectionNameInput
            defaultValue={collection.name}
            onCommit={(name) => {
              const trimmed = name.trim();
              if (trimmed && trimmed !== collection.name) {
                setState((s) =>
                  renameCollection(s, { id: collection.id, name: trimmed }),
                );
              }
              onStopEditing();
            }}
            onCancel={onStopEditing}
          />
        ) : (
          <span className="text-sm font-medium select-none">
            {collection.name}
          </span>
        )}
        <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground border border-border rounded-[3px] px-1.5">
          {collectionFiles.length}
        </span>
        <FileActionsDropdown
          testId="collection-more-button"
          buttonClassName="w-6 h-6 p-0 shrink-0"
          contentClassName="print:hidden w-fit min-w-[140px]"
        >
          <DropdownMenuItem onSelect={onStartEditing}>
            <Edit3Icon className={MENU_ITEM_ICON_CLASS} />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="danger"
            onSelect={() => setState((s) => deleteCollection(s, collection.id))}
          >
            <Trash2Icon className={MENU_ITEM_ICON_CLASS} />
            Delete collection
          </DropdownMenuItem>
        </FileActionsDropdown>
      </div>
      {!collapsed &&
        (visibleFiles.length > 0 ? (
          <div className="flex flex-col divide-y divide-border border rounded-lg overflow-hidden bg-background">
            {visibleFiles.map((file) => (
              <CollectionNotebookRow key={file.path} file={file} root={root} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground pl-6 py-1 select-none">
            Empty collection — use a notebook's "···" menu to add notebooks.
          </p>
        ))}
    </div>
  );
};

const CollectionNotebookRow: React.FC<{ file: FileInfo; root: string }> = ({
  file,
  root,
}) => {
  const Icon = FILE_TYPE_ICONS[guessFileType(file.name)];
  return (
    <div className="flex items-center pl-1 text-muted-foreground whitespace-nowrap group h-[26px] shrink-0">
      <NotebookRowLink
        relativePath={relativeToRoot(file.path, root)}
        name={file.name}
        icon={<Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />}
        actions={
          <FileActionsDropdown
            testId="collection-notebook-more-button"
            buttonClassName="w-8 h-8 p-0 shrink-0"
            contentClassName="print:hidden w-fit min-w-[180px]"
            preventDefaultOnTrigger={true}
          >
            <CollectionMenuItems path={file.path} />
          </FileActionsDropdown>
        }
      />
    </div>
  );
};

/**
 * "Add to collection > …" / "Remove from collection" dropdown items for a
 * notebook row. Shared between the workspace file tree's actions menu and
 * collection rows. `path` is the workspace tree path (the tree's row id).
 */
export const CollectionMenuItems: React.FC<{
  path: string;
  leadingSeparator?: boolean;
}> = ({ path, leadingSeparator = false }) => {
  const [state, setState] = useAtom(collectionsAtom);
  const { openPrompt } = useImperativeModal();
  const current = collectionContainingPath(state, path);

  const handleNewCollection = () => {
    openPrompt({
      title: "New collection",
      description:
        "Collections group notebooks on your home page. They don't move files on disk.",
      confirmText: "Create",
      onConfirm: (value) => {
        const name = value.trim();
        if (!name) {
          return;
        }
        setState((s) => {
          const { state: next, id } = createCollection(s, name);
          return addPathToCollection(next, { id, path });
        });
      },
    });
  };

  return (
    <>
      {leadingSeparator && <DropdownMenuSeparator />}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <FolderPlusIcon strokeWidth={1.5} className={MENU_ITEM_ICON_CLASS} />
          Add to collection
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-fit min-w-[160px]">
          {state.collections.map((collection) => (
            <DropdownMenuItem
              key={collection.id}
              disabled={collection.id === current?.id}
              onSelect={() =>
                setState((s) =>
                  addPathToCollection(s, { id: collection.id, path }),
                )
              }
            >
              {collection.name}
            </DropdownMenuItem>
          ))}
          {state.collections.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem onSelect={handleNewCollection}>
            <PlusIcon strokeWidth={1.5} className={MENU_ITEM_ICON_CLASS} />
            New collection…
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      {current && (
        <DropdownMenuItem
          onSelect={() => setState((s) => removePathFromCollections(s, path))}
        >
          <FolderMinusIcon strokeWidth={1.5} className={MENU_ITEM_ICON_CLASS} />
          Remove from collection
        </DropdownMenuItem>
      )}
    </>
  );
};

/**
 * Inline name editor for a collection header. Commits on Enter/blur,
 * cancels on Escape (mirrors the file tree's inline rename behavior).
 */
const CollectionNameInput: React.FC<{
  defaultValue: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}> = ({ defaultValue, onCommit, onCancel }) => {
  const cancelledRef = useRef(false);
  return (
    <input
      // oxlint-disable-next-line jsx_a11y/no-autofocus
      autoFocus={true}
      defaultValue={defaultValue}
      aria-label="Collection name"
      data-testid="collection-name-input"
      spellCheck={false}
      className="h-6 px-1 text-sm font-medium bg-background border border-border rounded-[3px] outline-none focus:border-primary"
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          cancelledRef.current = true;
          onCancel();
        }
      }}
      onBlur={(e) => {
        if (!cancelledRef.current) {
          onCommit(e.currentTarget.value);
        }
      }}
    />
  );
};
