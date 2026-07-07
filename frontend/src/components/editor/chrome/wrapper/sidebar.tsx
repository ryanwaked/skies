/* Copyright 2026 Marimo. All rights reserved. */

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { CommandIcon, CpuIcon, KeyboardIcon, MemoryStickIcon } from "lucide-react";
import type React from "react";
import type { PropsWithChildren } from "react";
import { useEffect, useMemo, useState } from "react";
import { keyboardShortcutsAtom } from "@/components/editor/controls/keyboard-shortcuts";
import { commandPaletteAtom } from "@/components/editor/controls/state";
import { renderShortcut } from "@/components/shortcuts/renderShortcut";
import { ReorderableList } from "@/components/ui/reorderable-list";
import { Tooltip } from "@/components/ui/tooltip";
import {
  cellErrorCount,
  notebookQueuedOrRunningCountAtom,
} from "@/core/cells/cells";
import { capabilitiesAtom } from "@/core/config/capabilities";
import { aiEnabledAtom } from "@/core/config/config";
import { connectionAtom } from "@/core/network/connection";
import { useRequestClient } from "@/core/network/requests";
import { isWasm } from "@/core/wasm/utils";
import { WebSocketState } from "@/core/websocket/types";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useInterval } from "@/hooks/useInterval";
import { cn } from "@/utils/cn";
import { panelLayoutAtom, useChromeActions, useChromeState } from "../state";
import {
  isPanelHidden,
  PANEL_MAP,
  PANELS,
  type PanelDescriptor,
} from "../types";
import { RuntimeSettings } from "./footer-items/runtime-settings";
import { PANEL_PRELOADERS } from "./lazy-panels";

export const Sidebar: React.FC = () => {
  const { selectedPanel, selectedDeveloperPanelTab, isSidebarOpen } =
    useChromeState();
  const { toggleApplication, openApplication, setIsSidebarOpen } =
    useChromeActions();
  const [panelLayout, setPanelLayout] = useAtom(panelLayoutAtom);
  // Subscribe to capabilities to re-render when they change
  const capabilities = useAtomValue(capabilitiesAtom);
  const aiEnabled = useAtomValue(aiEnabledAtom);

  const renderIcon = ({ Icon }: PanelDescriptor, className?: string) => {
    return (
      <Icon strokeWidth={1.5} className={cn("h-[16px] w-[16px]", className)} />
    );
  };

  // Get panels available for sidebar context menu
  // Only show panels that are NOT in the developer panel
  const availableSidebarPanels = useMemo(() => {
    const devPanelIds = new Set(panelLayout.developerPanel);
    return PANELS.filter((p) => {
      if (isPanelHidden({ panel: p, capabilities, aiEnabled })) {
        return false;
      }
      // Exclude panels that are in the developer panel
      if (devPanelIds.has(p.type)) {
        return false;
      }
      return true;
    });
  }, [panelLayout.developerPanel, capabilities, aiEnabled]);

  // Convert current sidebar items to PanelDescriptors
  // Filter out hidden panels (e.g., when capability is not available)
  const sidebarItems = useMemo(() => {
    return panelLayout.sidebar.flatMap((id) => {
      const panel = PANEL_MAP.get(id);
      if (!panel || isPanelHidden({ panel, capabilities, aiEnabled })) {
        return [];
      }
      return [panel];
    });
  }, [panelLayout.sidebar, capabilities, aiEnabled]);

  const handleSetSidebarItems = (items: PanelDescriptor[]) => {
    setPanelLayout((prev) => ({
      ...prev,
      sidebar: items.map((item) => item.type),
    }));
  };

  const handleReceive = (item: PanelDescriptor, fromListId: string) => {
    // Remove from the source list
    if (fromListId === "developer-panel") {
      setPanelLayout((prev) => ({
        ...prev,
        developerPanel: prev.developerPanel.filter((id) => id !== item.type),
      }));

      // If the moved item was selected in dev panel, select the first remaining item
      if (selectedDeveloperPanelTab === item.type) {
        const remainingDevPanels = panelLayout.developerPanel.filter(
          (id) => id !== item.type,
        );
        if (remainingDevPanels.length > 0) {
          openApplication(remainingDevPanels[0]);
        }
      }
    }

    // Select the dropped item in sidebar
    toggleApplication(item.type);
  };

  // Auto-correct sidebar selection when the selected panel is no longer available
  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }
    const isSelectionValid = sidebarItems.some((p) => p.type === selectedPanel);
    if (!isSelectionValid) {
      if (sidebarItems.length > 0) {
        openApplication(sidebarItems[0].type);
      } else {
        setIsSidebarOpen(false);
      }
    }
  }, [
    isSidebarOpen,
    sidebarItems,
    selectedPanel,
    openApplication,
    setIsSidebarOpen,
  ]);

  return (
    <div
      data-testid="chrome-sidebar"
      // Skies' collapsed rail has no right border — the vertical divider only
      // appears at the open panel's right edge (app-chrome's helperPanel).
      className="h-full w-[44px] shrink-0 pt-1.5 pb-1.5 flex flex-col items-center gap-0 text-foreground text-sm select-none z-50 bg-background print:hidden hide-on-fullscreen"
    >
      <ReorderableList<PanelDescriptor>
        value={sidebarItems}
        setValue={handleSetSidebarItems}
        getKey={(p) => p.type}
        availableItems={availableSidebarPanels}
        crossListDrag={{
          dragType: "panels",
          listId: "sidebar",
          onReceive: handleReceive,
        }}
        getItemLabel={(panel) => (
          <span className="flex items-center gap-2">
            {renderIcon(panel, "h-[16px] w-[16px] text-muted-foreground")}
            {panel.label}
          </span>
        )}
        ariaLabel="Sidebar panels"
        className="flex flex-col items-center gap-0"
        minItems={0}
        onAction={(panel) => toggleApplication(panel.type)}
        onItemPreloadHint={(panel) => PANEL_PRELOADERS[panel.type]?.()}
        renderItem={(panel) => (
          <SidebarItem
            tooltip={panel.tooltip}
            selected={selectedPanel === panel.type}
          >
            {panel.type === "errors" ? (
              <ErrorPanelIcon Icon={panel.Icon} />
            ) : (
              renderIcon(panel)
            )}
          </SidebarItem>
        )}
      />
      <div className="flex-1" />
      <QueuedOrRunningStack />
      <RailUtilityButtons />
      <RailResourceBars />
    </div>
  );
};

const ErrorPanelIcon: React.FC<{ Icon: PanelDescriptor["Icon"] }> = ({
  Icon,
}) => {
  const errorCount = useAtomValue(cellErrorCount);
  return (
    <Icon
      strokeWidth={1.5}
      className={cn("h-[16px] w-[16px]", errorCount > 0 && "text-destructive")}
    />
  );
};

const QueuedOrRunningStack = () => {
  const count = useAtomValue(notebookQueuedOrRunningCountAtom);
  // Skies rail status: a tiny dot (faint when idle, warn token while
  // cells are queued/running) with a quiet count beneath it.
  return (
    <Tooltip
      content={
        count > 0 ? (
          <span>
            {count} cell{count > 1 ? "s" : ""} queued or running
          </span>
        ) : (
          "No cells queued or running"
        )
      }
      side="right"
      delayDuration={200}
    >
      <div className="flex h-[36px] w-[36px] flex-col items-center justify-center gap-1">
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            count > 0 ? "bg-action-foreground" : "bg-muted-foreground/40",
          )}
        />
        {count > 0 && (
          <span className="text-[10px] font-medium leading-none tabular-nums text-action-foreground">
            {count}
          </span>
        )}
      </div>
    </Tooltip>
  );
};

const SidebarItem: React.FC<
  PropsWithChildren<{
    selected: boolean;
    tooltip: React.ReactNode;
    className?: string;
    onClick?: () => void;
  }>
> = ({ children, tooltip, selected, className, onClick }) => {
  // Skies rail geometry (from frontend/hex-measurements.json): 36x36 item box, 16px icon, 3px radius,
  // flush 36px pitch (zero gap). Resting icons are foreground (#e4e6ec) —
  // not muted; hover adds a faint neutral wash; active is primary on a
  // primary tint.
  const itemClassName = cn(
    "flex items-center justify-center h-[36px] w-[36px] rounded-[3px]",
    !selected && "text-foreground hover:bg-[rgba(63,66,87,0.2)]",
    selected && "bg-primary/[0.07] text-primary",
    className,
  );

  // Render as div when not clickable (e.g., inside ReorderableList)
  // This avoids nested interactive elements which break react-aria's drag behavior
  const content = onClick ? (
    <button type="button" className={itemClassName} onClick={onClick}>
      {children}
    </button>
  ) : (
    <div className={itemClassName}>{children}</div>
  );

  return (
    <Tooltip content={tooltip} side="right" delayDuration={200}>
      {content}
    </Tooltip>
  );
};

/** Utility buttons at the rail bottom (moved out of the old status footer). */
const RailUtilityButtons: React.FC = () => {
  const setCommandPaletteOpen = useSetAtom(commandPaletteAtom);
  const setKeyboardShortcutsOpen = useSetAtom(keyboardShortcutsAtom);
  return (
    <div className="flex flex-col items-center gap-0">
      <SidebarItem
        tooltip={renderShortcut("global.commandPalette")}
        selected={false}
        onClick={() => setCommandPaletteOpen((v) => !v)}
      >
        <CommandIcon className="h-[16px] w-[16px]" strokeWidth={1.5} />
      </SidebarItem>
      <SidebarItem
        tooltip="Keyboard shortcuts"
        selected={false}
        onClick={() => setKeyboardShortcutsOpen((v) => !v)}
      >
        <KeyboardIcon className="h-[16px] w-[16px]" strokeWidth={1.5} />
      </SidebarItem>
      <RuntimeSettings variant="rail" />
    </div>
  );
};

const RailVerticalBar: React.FC<{
  percent: number;
  icon: React.ReactNode;
  tooltip: React.ReactNode;
}> = ({ percent, icon, tooltip }) => (
  <Tooltip content={tooltip} side="right" delayDuration={200}>
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-8 w-1.5 overflow-hidden rounded-full border border-border bg-muted">
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 rounded-full transition-[height] duration-500",
            percent >= 90
              ? "bg-error"
              : percent >= 75
                ? "bg-action-foreground"
                : "bg-primary",
          )}
          style={{ height: `${Math.max(3, Math.min(100, percent))}%` }}
        />
      </div>
      <span className="text-muted-foreground">{icon}</span>
    </div>
  </Tooltip>
);

/** Two vertical resource bars (memory + CPU) pinned to the very bottom. */
const RailResourceBars: React.FC = () => {
  const [nonce, setNonce] = useState(0);
  const connection = useAtomValue(connectionAtom);
  const { getUsageStats } = useRequestClient();
  useInterval(() => setNonce((n) => n + 1), {
    delayMs: 10_000,
    whenVisible: true,
  });
  const { data } = useAsyncData(async () => {
    if (isWasm() || connection.state !== WebSocketState.OPEN) {
      return null;
    }
    return getUsageStats();
  }, [nonce, connection.state]);

  if (!data) {
    return null;
  }
  const memPct = Math.round(data.memory.percent);
  const cpuPct = Math.round(data.cpu.percent);
  const gb = (bytes: number) => (bytes / 1024 ** 3).toFixed(1);
  return (
    <div className="flex items-end justify-center gap-2.5 pt-2 pb-1">
      <RailVerticalBar
        percent={memPct}
        icon={<MemoryStickIcon className="h-3 w-3" strokeWidth={1.5} />}
        tooltip={
          <span>
            <b>Memory:</b> {gb(data.memory.total - data.memory.available)} /{" "}
            {gb(data.memory.total)} GB ({memPct}%)
          </span>
        }
      />
      <RailVerticalBar
        percent={cpuPct}
        icon={<CpuIcon className="h-3 w-3" strokeWidth={1.5} />}
        tooltip={
          <span>
            <b>CPU:</b> {cpuPct}%
          </span>
        }
      />
    </div>
  );
};
