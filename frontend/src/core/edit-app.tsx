/* Copyright 2026 Marimo. All rights reserved. */

import { usePrevious } from "@dnd-kit/utilities";
import { Tooltip } from "radix-ui";

const TooltipProvider = Tooltip.Provider;

import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { NotStartedConnectionAlert } from "@/components/editor/alerts/connecting-alert";
import { Controls } from "@/components/editor/controls/Controls";
import { AppHeader } from "@/components/editor/header/app-header";
import { MultiCellActionToolbar } from "@/components/editor/navigation/multi-cell-action-toolbar";
import { ViewerBanner } from "@/components/editor/viewer-banner";
import { cn } from "@/utils/cn";
import { Paths } from "@/utils/paths";
import { AppContainer } from "../components/editor/app-container";
import {
  useRunAllCells,
  useRunStaleCells,
} from "../components/editor/cell/useRunCells";
import { useSetCodeVisibility } from "../components/editor/actions/useSetCodeVisibility";
import { CellArray } from "../components/editor/renderers/cell-array";
import { CellsRenderer } from "../components/editor/renderers/cells-renderer";
import { useHotkey } from "../hooks/useHotkey";
import {
  hasCellsAtom,
  notebookIsRunningAtom,
  numColumnsAtom,
  useCellActions,
} from "./cells/cells";
import type { AppConfig, UserConfig } from "./config/config-schema";
import { RuntimeState } from "./kernel/RuntimeState";
import { getSessionId } from "./kernel/session";
import { useTogglePresenting } from "./layout/useTogglePresenting";
import { viewStateAtom } from "./mode";
import { useRequestClient } from "./network/requests";
import { useFilename } from "./saving/filename";
import { lastSavedNotebookAtom } from "./saving/state";
import { useMarimoKernelConnection } from "./websocket/useMarimoKernelConnection";

interface AppProps {
  /**
   * The user config.
   */
  userConfig: UserConfig;
  /**
   * The app config.
   */
  appConfig: AppConfig;
  /**
   * If true, the floating controls will be hidden.
   */
  hideControls?: boolean;
}

export const EditApp: React.FC<AppProps> = ({
  userConfig,
  appConfig,
  hideControls = false,
}) => {
  const { setCells, mergeAllColumns, collapseAllCells, expandAllCells } =
    useCellActions();
  const viewState = useAtomValue(viewStateAtom);
  const numColumns = useAtomValue(numColumnsAtom);
  const hasCells = useAtomValue(hasCellsAtom);
  const filename = useFilename();
  const setLastSavedNotebook = useSetAtom(lastSavedNotebookAtom);
  const { sendComponentValues, sendInterrupt } = useRequestClient();

  const isEditing = viewState.mode === "edit";
  const isPresenting = viewState.mode === "present";
  const isRunning = useAtomValue(notebookIsRunningAtom);
  // The Skies top bar is shown in both edit and present mode; present
  // mode needs it to switch back via the Notebook/App builder control.
  const showHeaderBar = !hideControls && (isEditing || isPresenting);

  // Initialize RuntimeState event-listeners
  useEffect(() => {
    RuntimeState.INSTANCE.start(sendComponentValues);
    return () => {
      RuntimeState.INSTANCE.stop();
    };
  }, []);

  const { connection, reconnect } = useMarimoKernelConnection({
    autoInstantiate: userConfig.runtime.auto_instantiate,
    setCells: (cells, layout) => {
      setCells(cells);
      const names = cells.map((cell) => cell.name);
      const codes = cells.map((cell) => cell.code);
      const configs = cells.map((cell) => cell.config);
      setLastSavedNotebook({ names, codes, configs, layout });
    },
    sessionId: getSessionId(),
  });

  // Update document title whenever filename or app_title changes
  useEffect(() => {
    // Set document title: app_title takes precedence, then filename, then default
    document.title =
      appConfig.app_title ||
      Paths.basename(filename ?? "") ||
      "Untitled Notebook";
  }, [appConfig.app_title, filename]);

  // Delete column breakpoints if app width changes from "columns"
  const previousWidth = usePrevious(appConfig.width);
  useEffect(() => {
    if (previousWidth === "columns" && appConfig.width !== "columns") {
      mergeAllColumns();
    }
  }, [appConfig.width, previousWidth, mergeAllColumns, numColumns]);

  const runStaleCells = useRunStaleCells();
  const runAllCells = useRunAllCells();
  const togglePresenting = useTogglePresenting();
  const setCodeVisibility = useSetCodeVisibility();

  // HOTKEYS
  useHotkey("global.runStale", () => {
    runStaleCells();
  });
  useHotkey("global.interrupt", () => {
    sendInterrupt();
  });
  useHotkey("global.hideCode", () => {
    togglePresenting();
  });
  useHotkey("global.runAll", () => {
    runAllCells();
  });
  useHotkey("global.showAllCode", () => {
    setCodeVisibility(false, "code");
  });
  useHotkey("global.hideAllCode", () => {
    setCodeVisibility(true, "code");
  });
  useHotkey("global.showAllMarkdownCode", () => {
    setCodeVisibility(false, "markdown");
  });
  useHotkey("global.hideAllMarkdownCode", () => {
    setCodeVisibility(true, "markdown");
  });
  useHotkey("global.collapseAllSections", () => {
    collapseAllCells();
  });
  useHotkey("global.expandAllSections", () => {
    expandAllCells();
  });

  const editableCellsArray = (
    <CellArray
      mode={viewState.mode}
      userConfig={userConfig}
      appConfig={appConfig}
      hideControls={hideControls}
    />
  );

  return (
    <>
      <AppContainer
        connection={connection}
        isRunning={isRunning}
        width={appConfig.width}
        onReconnect={reconnect}
        hideRunningIndicator={showHeaderBar}
      >
        <AppHeader
          connection={connection}
          className={cn(
            "print:hidden z-50",
            // Keep the header sticky when scrolling horizontally, for column mode
            "sticky left-0",
            // The Skies top bar lives in AppChrome (edge to edge, above the icon
            // rail); this header only hosts the disconnected overlay and the
            // spacing above the first cell.
            showHeaderBar ? "top-0 mb-4" : "pt-4 sm:pt-12 pb-2 mb-4",
          )}
        />

        <ViewerBanner />

        {/* Don't render until we have a single cell */}
        {hasCells && (
          <CellsRenderer appConfig={appConfig} mode={viewState.mode}>
            {editableCellsArray}
          </CellsRenderer>
        )}
        {!hasCells && <NotStartedConnectionAlert />}
      </AppContainer>
      <MultiCellActionToolbar />
      {!hideControls && (
        <TooltipProvider>
          <Controls presenting={isPresenting} />
        </TooltipProvider>
      )}
    </>
  );
};
