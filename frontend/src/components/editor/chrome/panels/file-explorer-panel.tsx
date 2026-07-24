/* Copyright 2026 Marimo. All rights reserved. */

import { useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { FileIcon, HardDrive } from "lucide-react";
import React, { useCallback, useMemo } from "react";
import useResizeObserver from "use-resize-observer";
import { StorageInspector } from "@/components/storage/storage-inspector";
import { storageNamespacesAtom } from "@/core/storage/state";
import { cn } from "@/utils/cn";
import { jotaiJsonStorage } from "@/utils/storage/jotai";
import { TreeDndProvider } from "../../file-tree/dnd-wrapper";
import { FileExplorer } from "../../file-tree/file-explorer";
import { useFileExplorerUpload } from "../../file-tree/upload";
import { PanelBadge, ResizablePanelSections } from "./components";

type OpenSections = "files" | "remote-storage";

interface FileExplorerPanelState {
  openSections: OpenSections[];
  hasUserInteracted: boolean;
}

const fileExplorerPanelAtom = atomWithStorage<FileExplorerPanelState>(
  "marimo:file-explorer-panel:state",
  { openSections: ["files"], hasUserInteracted: false },
  jotaiJsonStorage,
);

const FileExplorerComponent: React.FC = () => {
  const { ref, height = 0 } = useResizeObserver<HTMLDivElement>();
  const { getRootProps, getInputProps, isDragActive } = useFileExplorerUpload({
    noClick: true,
    noKeyboard: true,
  });

  return (
    <div ref={ref} className="h-full min-h-0">
      <TreeDndProvider>
        <div
          {...getRootProps()}
          className={cn(
            "h-full flex flex-col overflow-hidden relative bg-card",
          )}
        >
          <input {...getInputProps()} />
          {isDragActive && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none rounded-[3px] border border-dashed border-primary/60 bg-card/90 text-xs font-semibold uppercase tracking-wide text-primary">
              Drop files here
            </div>
          )}

          {height > 0 && <FileExplorer height={height} />}
        </div>
      </TreeDndProvider>
    </div>
  );
};

const FileExplorerPanel: React.FC = () => {
  const [state, setState] = useAtom(fileExplorerPanelAtom);

  const storageNamespaces = useAtomValue(storageNamespacesAtom);
  const remoteStorageConnections = storageNamespaces.length;

  const openSections = useMemo<OpenSections[]>(() => {
    if (!state.hasUserInteracted && remoteStorageConnections > 0) {
      if (state.openSections.includes("remote-storage")) {
        return state.openSections;
      }
      return [...state.openSections, "remote-storage"];
    }
    return state.openSections;
  }, [state.hasUserInteracted, state.openSections, remoteStorageConnections]);

  const handleOpenSectionsChange = useCallback(
    (open: string[]) => {
      setState({
        openSections: open as OpenSections[],
        hasUserInteracted: true,
      });
    },
    [setState],
  );

  return (
    <ResizablePanelSections
      storageKey="file-explorer"
      sections={[
        {
          id: "remote-storage",
          header: (
            <>
              <HardDrive className="w-3 h-3" strokeWidth={1.5} /> Remote
              storage
              {remoteStorageConnections > 0 && (
                <PanelBadge>{remoteStorageConnections}</PanelBadge>
              )}
            </>
          ),
          content: (
            <div className="h-full overflow-y-auto overflow-x-hidden">
              <StorageInspector />
            </div>
          ),
          defaultSize: 40,
        },
        {
          id: "files",
          header: (
            <>
              <FileIcon className="w-3 h-3" strokeWidth={1.5} />
              Files
            </>
          ),
          content: <FileExplorerComponent />,
          defaultSize: 60,
        },
      ]}
      openSections={openSections}
      onOpenSectionsChange={handleOpenSectionsChange}
    />
  );
};

export default FileExplorerPanel;
