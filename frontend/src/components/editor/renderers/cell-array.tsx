/* Copyright 2026 Marimo. All rights reserved. */

import {
  horizontalListSortingStrategy,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { StartupLogsAlert } from "@/components/editor/alerts/startup-logs-alert";
import { Cell } from "@/components/editor/notebook-cell";
import { PackageAlert } from "@/components/editor/package-alert";
import { SortableCellsProvider } from "@/components/sort/SortableCellsProvider";
import { SETUP_CELL_ID } from "@/core/cells/ids";
import { cn } from "@/utils/cn";
import { Functions } from "@/utils/functions";
import type { CellColumnId } from "@/utils/id-tree";
import { invariant } from "@/utils/invariant";
import {
  columnIdsAtom,
  useCellActions,
  useCellIds,
  useScrollKey,
} from "../../../core/cells/cells";
import { formatAll } from "../../../core/codemirror/format";
import type { AppConfig, UserConfig } from "../../../core/config/config-schema";
import type { AppMode } from "../../../core/mode";
import { useHotkey } from "../../../hooks/useHotkey";
import { type Theme, useTheme } from "../../../theme/useTheme";
import {
  ConnectingAlert,
  NotStartedConnectionAlert,
} from "../alerts/connecting-alert";
import { FloatingOutline } from "../chrome/panels/outline/floating-outline";
import { useChromeActions } from "../chrome/state";
import { Column } from "../columns/cell-column";
import { NotebookBanner } from "../notebook-banner";
import { StdinBlockingAlert } from "../stdin-blocking-alert";
import { AddCellToolbar } from "./add-cell-toolbar";
import { useFocusFirstEditor } from "./vertical-layout/useFocusFirstEditor";
import { VerticalLayoutWrapper } from "./vertical-layout/vertical-layout-wrapper";

interface CellArrayProps {
  mode: AppMode;
  userConfig: UserConfig;
  appConfig: AppConfig;
  hideControls?: boolean;
}

export const CellArray: React.FC<CellArrayProps> = (props) => {
  const columnIds = useAtomValue(columnIdsAtom);

  // Setup context for sorting
  return (
    <SortableCellsProvider multiColumn={props.appConfig.width === "columns"}>
      <SortableContext
        data-testid="column-container"
        items={columnIds}
        strategy={horizontalListSortingStrategy}
      >
        <CellArrayInternal {...props} />
      </SortableContext>
    </SortableCellsProvider>
  );
};

const CellArrayInternal: React.FC<CellArrayProps> = ({
  mode,
  userConfig,
  appConfig,
  hideControls = false,
}) => {
  const actions = useCellActions();
  const { theme } = useTheme();
  const { toggleSidebarPanel } = useChromeActions();

  // Side-effects
  useFocusFirstEditor();

  // HOTKEYS
  useHotkey("global.focusTop", actions.focusTopCell);
  useHotkey("global.focusBottom", actions.focusBottomCell);
  useHotkey("global.toggleSidebar", toggleSidebarPanel);
  useHotkey("global.foldCode", actions.foldAll);
  useHotkey("global.unfoldCode", actions.unfoldAll);
  useHotkey("global.formatAll", () => {
    formatAll();
  });
  // Catch all to avoid native OS behavior
  // Otherwise a user might try to hide a cell and accidentally hide the OS window
  useHotkey("cell.hideCode", Functions.NOOP);
  useHotkey("cell.format", Functions.NOOP);

  const cellIds = useCellIds();
  const scrollKey = useScrollKey();
  const columnIds = cellIds.getColumnIds();

  // Scroll to a cell targeted by a previous action
  const scrollToTarget = actions.scrollToTarget;
  useEffect(() => {
    if (scrollKey !== null) {
      scrollToTarget();
    }
  }, [cellIds, scrollKey, scrollToTarget]);

  return (
    <VerticalLayoutWrapper
      // 'pb' allows the user to put the cell in the middle of the screen
      className="pb-[40vh]"
      invisible={false}
      appConfig={appConfig}
      innerClassName="pr-4" // For the floating actions
    >
      <PackageAlert />
      <StartupLogsAlert />
      <StdinBlockingAlert />
      <ConnectingAlert />
      <NotebookBanner width={appConfig.width} />
      {/* Only show if not cells, otherwise running a single cell will start the connection */}
      {cellIds.idLength === 0 && <NotStartedConnectionAlert />}
      <div
        className={cn(
          appConfig.width === "columns" &&
            "grid grid-flow-col auto-cols-min gap-6",
        )}
      >
        {columnIds.map((columnId, index) => (
          <CellColumn
            key={columnId}
            columnId={columnId}
            index={index}
            columnsLength={columnIds.length}
            appConfig={appConfig}
            mode={mode}
            userConfig={userConfig}
            theme={theme}
            hideControls={hideControls}
          />
        ))}
      </div>
      <FloatingOutline />
    </VerticalLayoutWrapper>
  );
};

/**
 * A single column of cells.
 */
const CellColumn: React.FC<{
  columnId: CellColumnId;
  index: number;
  columnsLength: number;
  appConfig: AppConfig;
  mode: AppMode;
  userConfig: UserConfig;
  theme: Theme;
  hideControls: boolean;
}> = ({
  columnId,
  index,
  columnsLength,
  appConfig,
  mode,
  userConfig,
  theme,
  hideControls,
}) => {
  const cellIds = useCellIds();
  const column = cellIds.get(columnId);
  invariant(column, `Expected column for: ${columnId}`);

  const hasOnlyOneCell = cellIds.hasOnlyOneId();
  const hasSetupCell = cellIds.inOrderIds.includes(SETUP_CELL_ID);

  return (
    <Column
      columnId={columnId}
      index={index}
      canMoveLeft={index > 0}
      canMoveRight={index < columnsLength - 1}
      width={appConfig.width}
      canDelete={columnsLength > 1}
      footer={
        hideControls ? null : (
          <AddCellButtons
            columnId={columnId}
            className={cn(
              appConfig.width === "columns" &&
                "opacity-0 group-hover/column:opacity-100",
            )}
          />
        )
      }
    >
      <SortableContext
        id={`column-${index + 1}`}
        items={column.topLevelIds}
        strategy={verticalListSortingStrategy}
      >
        {/* Render the setup cell first, always */}
        {index === 0 && hasSetupCell && (
          <Cell
            key={SETUP_CELL_ID}
            cellId={SETUP_CELL_ID}
            theme={theme}
            showPlaceholder={false}
            canDelete={true}
            mode={mode}
            userConfig={userConfig}
            isCollapsed={false}
            collapseCount={0}
            canMoveX={false}
          />
        )}

        {column.topLevelIds.map((cellId) => {
          // Skip the setup cell later
          if (cellId === SETUP_CELL_ID) {
            return null;
          }

          return (
            <Cell
              key={cellId}
              cellId={cellId}
              theme={theme}
              showPlaceholder={hasOnlyOneCell}
              canDelete={!hasOnlyOneCell}
              mode={mode}
              userConfig={userConfig}
              isCollapsed={column.isCollapsed(cellId)}
              collapseCount={column.getCount(cellId)}
              canMoveX={appConfig.width === "columns"}
            />
          );
        })}
      </SortableContext>
    </Column>
  );
};

const AddCellButtons: React.FC<{
  columnId: CellColumnId;
  className?: string;
}> = ({ columnId, className }) => {
  return <AddCellToolbar columnId={columnId} className={className} />;
};
