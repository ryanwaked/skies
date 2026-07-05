/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue, useSetAtom } from "jotai";
import {
  AlertTriangleIcon,
  CommandIcon,
  Undo2Icon,
  XCircleIcon,
} from "lucide-react";
import type React from "react";
import { commandPaletteAtom } from "@/components/editor/controls/state";
import { renderShortcut } from "@/components/shortcuts/renderShortcut";
import { Tooltip } from "@/components/ui/tooltip";
import {
  canUndoDeletesAtom,
  cellErrorCount,
  undoLabelAtom,
  useCellActions,
} from "@/core/cells/cells";
import { isConnectingAtom } from "@/core/network/connection";
import { useHotkey } from "@/hooks/useHotkey";
import { ShowInKioskMode } from "../../kiosk-mode";
import { panelLayoutAtom, useChromeActions, useChromeState } from "../state";
import { FooterItem } from "./footer-item";
import {
  BackendConnectionStatus,
  connectionStatusAtom,
} from "./footer-items/backend-status";
import { MachineStats } from "./footer-items/machine-stats";
import { PyodideStatus } from "./footer-items/pyodide-status";
import { RTCStatus } from "./footer-items/rtc-status";
import { RuntimeSettings } from "./footer-items/runtime-settings";
import { useSetDependencyPanelTab } from "./useDependencyPanelTab";

export const Footer: React.FC = () => {
  const { isDeveloperPanelOpen } = useChromeState();
  const { toggleDeveloperPanel, toggleApplication } = useChromeActions();
  const setDependencyPanelTab = useSetDependencyPanelTab();

  const errorCount = useAtomValue(cellErrorCount);
  const connectionStatus = useAtomValue(connectionStatusAtom);
  const panelLayout = useAtomValue(panelLayoutAtom);

  // Show issue count: cell errors + connection issues
  // Don't include error count if errors panel is in sidebar (it shows there instead)
  const errorsInSidebar = panelLayout.sidebar.includes("errors");
  const hasConnectionIssue =
    connectionStatus === "unhealthy" || connectionStatus === "disconnected";
  const issueCount =
    (errorsInSidebar ? 0 : errorCount) + (hasConnectionIssue ? 1 : 0);

  // TODO: Add warning count from diagnostics/linting
  const warningCount = 0;

  useHotkey("global.toggleTerminal", () => {
    toggleApplication("terminal");
  });

  useHotkey("global.togglePanel", () => {
    toggleDeveloperPanel();
  });

  useHotkey("global.toggleMinimap", () => {
    toggleApplication("dependencies");
    setDependencyPanelTab("minimap");
  });

  return (
    <footer
      data-testid="chrome-footer"
      className="h-6.5 gap-0.5 bg-background flex items-center text-muted-foreground text-[11px] pl-1.5 pr-1 border-t border-border select-none print:hidden z-50 hide-on-fullscreen overflow-x-auto overflow-y-hidden scrollbar-thin"
    >
      <FooterItem
        className="h-full"
        tooltip={
          <span className="flex items-center gap-2">
            Toggle developer panel {renderShortcut("global.togglePanel", false)}
          </span>
        }
        selected={isDeveloperPanelOpen}
        onClick={() => toggleDeveloperPanel()}
        data-testid="footer-panel"
      >
        <div className="flex items-center gap-1 h-full">
          <XCircleIcon
            strokeWidth={1.5}
            className={`w-3.5 h-3.5 ${issueCount > 0 ? "text-error" : ""}`}
          />
          <span>{issueCount}</span>
          <AlertTriangleIcon
            strokeWidth={1.5}
            className={`w-3.5 h-3.5 ml-1 ${warningCount > 0 ? "text-action-foreground" : ""}`}
          />
          <span>{warningCount}</span>
        </div>
      </FooterItem>

      <RuntimeSettings />

      <div className="mx-auto" />

      <PyodideStatus />
      <ConnectingKernelIndicatorItem />

      <ShowInKioskMode>
        <Tooltip
          content={
            <div className="w-[200px]">
              Kiosk mode is enabled. This allows you to view the outputs of the
              cells without the ability to edit them.
            </div>
          }
        >
          <span className="text-muted-foreground text-[11px] mr-4">
            kiosk mode
          </span>
        </Tooltip>
      </ShowInKioskMode>

      <div className="flex items-center shrink-0 min-w-0">
        <UndoDeleteItem />
        <CommandPaletteItem />
        <MachineStats />
        <RTCStatus />
      </div>
    </footer>
  );
};

/** Command palette trigger — chrome lives in bars, not floating over cells. */
const CommandPaletteItem: React.FC = () => {
  const setCommandPaletteOpen = useSetAtom(commandPaletteAtom);
  return (
    <FooterItem
      tooltip={renderShortcut("global.commandPalette")}
      selected={false}
      onClick={() => setCommandPaletteOpen((value) => !value)}
      data-testid="footer-command-palette"
    >
      <CommandIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
    </FooterItem>
  );
};

/** Undo-delete affordance, shown only while an undo is available. */
const UndoDeleteItem: React.FC = () => {
  const undoAvailable = useAtomValue(canUndoDeletesAtom);
  const undoLabel = useAtomValue(undoLabelAtom);
  const { undoDeleteCell } = useCellActions();
  if (!undoAvailable) {
    return null;
  }
  return (
    <FooterItem
      tooltip={undoLabel}
      selected={false}
      onClick={undoDeleteCell}
      data-testid="footer-undo-delete"
    >
      <span className="flex items-center gap-1">
        <Undo2Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
        Undo
      </span>
    </FooterItem>
  );
};

/**
 * Only show the backend connection status if we are connecting to a kernel
 */
const ConnectingKernelIndicatorItem: React.FC = () => {
  const isConnecting = useAtomValue(isConnectingAtom);
  if (!isConnecting) {
    return null;
  }
  return <BackendConnectionStatus />;
};
