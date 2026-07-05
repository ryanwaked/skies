/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import {
  BetweenHorizontalStartIcon,
  BlocksIcon,
  DownloadIcon,
  PencilIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import type React from "react";
import { Suspense, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { EditorView } from "@codemirror/view";
import { useImperativeModal } from "@/components/modal/ImperativeModal";
import { AlertDialogDestructiveAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CommandList } from "cmdk";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { maybeAddMarimoImport } from "@/core/cells/add-missing-import";
import { useCellActions } from "@/core/cells/cells";
import { useLastFocusedCellId } from "@/core/cells/focus";
import {
  deleteLocalComponent,
  exportLocalComponents,
  importLocalComponents,
  type LocalComponent,
  localComponentsAtom,
  renameLocalComponent,
} from "@/core/components/local-components";
import { autoInstantiateAtom } from "@/core/config/config";
import { useTheme } from "@/theme/useTheme";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/utils/download";
import { HideInKioskMode } from "../../kiosk-mode";
import { LazyAnyLanguageCodeMirror } from "@/plugins/impl/code/LazyAnyLanguageCodeMirror";
import { usePanelOrientation, usePanelSection } from "./panel-context";
import { PanelEmptyState } from "./empty-state";

const extensions = [EditorView.lineWrapping];

/**
 * Components panel — the library of reusable cells ("Save as component"
 * in any cell's ··· menu). Search, preview, insert into the current
 * notebook, rename, delete, and export/import as JSON so components can
 * move between marimo servers (localStorage is origin-scoped).
 */
export const ComponentsPanel: React.FC = () => {
  const components = useAtomValue(localComponentsAtom);
  const [selectedId, setSelectedId] = useState<string>();
  const orientation = usePanelOrientation();
  const section = usePanelSection();
  const isVertical = orientation === "vertical";

  const selected = components.find((c) => c.id === selectedId);

  return (
    <div className="flex-1 overflow-hidden h-full">
      <PanelGroup key={section} direction={orientation} className="h-full">
        <Panel defaultSize={40} minSize={20} maxSize={70}>
          <div className="flex h-full flex-col">
            <Command className="flex-1 min-h-0 rounded-none bg-card">
              <div className="flex items-center w-full border-b">
                <CommandInput
                  placeholder="Search components..."
                  className="h-6 m-1"
                  rootClassName="flex-1 border-r"
                />
                <ExportImportButtons />
              </div>
              <CommandEmpty className="p-0">
                <PanelEmptyState
                  title="No components yet"
                  description="Save any cell as a component from its ··· menu, then reuse it in any notebook."
                  icon={<BlocksIcon />}
                />
              </CommandEmpty>
              <CommandList className="flex-1 max-h-none">
                {components.map((component) => (
                  <CommandItem
                    key={component.id}
                    value={`${component.name} ${component.description ?? ""}`}
                    onSelect={() => setSelectedId(component.id)}
                    className={cn(
                      "min-h-[26px] py-1 rounded-[3px]",
                      selectedId === component.id &&
                        "bg-primary/[0.07] text-primary",
                    )}
                  >
                    <BlocksIcon
                      strokeWidth={1.5}
                      className="h-3.5 w-3.5 mr-2 shrink-0 text-muted-foreground"
                    />
                    <span className="flex-1 truncate text-[13px]">
                      {component.name}
                    </span>
                    {component.description && (
                      <span className="ml-2 truncate text-[10.5px] font-mono text-[var(--foreground-dim)] max-w-[45%]">
                        {component.description}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </div>
        </Panel>
        <PanelResizeHandle
          className={cn(
            "bg-border hover:bg-primary/30 transition-colors",
            isVertical ? "h-1" : "w-1",
          )}
        />
        <Panel defaultSize={60} minSize={20} className="bg-card">
          <div className="h-full flex flex-col overflow-hidden">
            {selected ? (
              <ComponentViewer
                key={selected.id}
                component={selected}
                onClose={() => setSelectedId(undefined)}
              />
            ) : (
              <PanelEmptyState
                title=""
                description="Click on a component to view its code."
              />
            )}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
};

const ExportImportButtons: React.FC = () => {
  const components = useAtomValue(localComponentsAtom);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    downloadBlob(
      new Blob([exportLocalComponents()], { type: "application/json" }),
      "skies-components.json",
    );
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    try {
      const count = importLocalComponents(JSON.parse(await file.text()));
      toast({
        description:
          count === 0
            ? "No new components to import."
            : `Imported ${count} component${count === 1 ? "" : "s"}.`,
      });
    } catch {
      toast({
        variant: "danger",
        description: "Not a valid components export file.",
      });
    }
  };

  return (
    <HideInKioskMode>
      <Tooltip content="Export components as JSON (to reuse in another browser or server)">
        <button
          type="button"
          aria-label="Export components"
          disabled={components.length === 0}
          className="px-2 h-full text-muted-foreground hover:bg-[var(--hover-wash)] hover:text-foreground disabled:opacity-40"
          onClick={handleExport}
        >
          <DownloadIcon strokeWidth={1.5} className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
      <Tooltip content="Import components from JSON">
        <button
          type="button"
          aria-label="Import components"
          className="px-2 h-full text-muted-foreground hover:bg-[var(--hover-wash)] hover:text-foreground border-l"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon strokeWidth={1.5} className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void handleImportFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </HideInKioskMode>
  );
};

const ComponentViewer: React.FC<{
  component: LocalComponent;
  onClose: () => void;
}> = ({ component, onClose }) => {
  const { theme } = useTheme();
  const { createNewCell } = useCellActions();
  const lastFocusedCellId = useLastFocusedCellId();
  const autoInstantiate = useAtomValue(autoInstantiateAtom);
  const { openConfirm, openPrompt } = useImperativeModal();

  const handleInsert = () => {
    // Components commonly reference mo.*; make sure the import exists.
    if (/\bmo\./.test(component.code)) {
      maybeAddMarimoImport({
        autoInstantiate,
        createNewCell,
        fromCellId: lastFocusedCellId,
      });
    }
    createNewCell({
      code: component.code,
      before: false,
      cellId: lastFocusedCellId ?? "__end__",
    });
    toast({ description: `Inserted "${component.name}"` });
  };

  const handleRename = () => {
    openPrompt({
      title: "Rename component",
      defaultValue: component.name,
      confirmText: "Rename",
      onConfirm: (value) => {
        if (value.trim()) {
          renameLocalComponent(component.id, value);
        }
      },
    });
  };

  const handleDelete = () => {
    openConfirm({
      title: "Delete component",
      description: `Are you sure you want to delete "${component.name}"?`,
      variant: "destructive",
      confirmAction: (
        <AlertDialogDestructiveAction
          onClick={() => {
            deleteLocalComponent(component.id);
            onClose();
          }}
          aria-label="Confirm"
        >
          Delete
        </AlertDialogDestructiveAction>
      ),
    });
  };

  return (
    <>
      <div className="text-[13px] font-medium text-foreground border-b px-3 py-1.5 flex items-center gap-1">
        <span className="flex-1 truncate">{component.name}</span>
        <HideInKioskMode>
          <Tooltip content="Rename">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRename}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-[var(--hover-wash)]"
            >
              <PencilIcon strokeWidth={1.5} className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content="Delete">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-[var(--hover-wash)]"
            >
              <Trash2Icon strokeWidth={1.5} className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </HideInKioskMode>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-[var(--hover-wash)]"
        >
          <XIcon strokeWidth={1.5} className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="px-2 py-2 space-y-3 overflow-y-auto overflow-x-hidden flex-1">
        <div className="flex items-center justify-between gap-2">
          {component.description ? (
            <span className="text-[10.5px] font-mono text-[var(--foreground-dim)] truncate">
              {component.description}
            </span>
          ) : (
            <span />
          )}
          <HideInKioskMode>
            <Button size="xs" variant="outline" onClick={handleInsert}>
              Insert component
              <BetweenHorizontalStartIcon
                strokeWidth={1.5}
                className="ml-2 h-4 w-4"
              />
            </Button>
          </HideInKioskMode>
        </div>
        <Suspense>
          <LazyAnyLanguageCodeMirror
            theme={theme === "dark" ? "dark" : "light"}
            language="python"
            className="cm border rounded overflow-hidden"
            extensions={extensions}
            value={component.code}
            readOnly={true}
          />
        </Suspense>
      </div>
    </>
  );
};

export default ComponentsPanel;
