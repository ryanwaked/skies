/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import { HourglassIcon, UnlinkIcon } from "lucide-react";
import React from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { notebookScrollToRunning } from "@/core/cells/actions";
import { onlyScratchpadIsRunningAtom } from "@/core/cells/cells";
import { viewStateAtom } from "@/core/mode";
import {
  type ConnectionStatus,
  WebSocketClosedReason,
  WebSocketState,
} from "@/core/websocket/types";
import { cn } from "@/utils/cn";

export const StatusOverlay: React.FC<{
  connection: ConnectionStatus;
  isRunning: boolean;
  onReconnect?: () => void;
  /**
   * Hide the floating "running" icon; used when the notebook header bar
   * already renders an inline status indicator.
   */
  hideRunningIndicator?: boolean;
}> = ({ connection, isRunning, onReconnect, hideRunningIndicator = false }) => {
  const { mode } = useAtomValue(viewStateAtom);
  const isClosed = connection.state === WebSocketState.CLOSED;
  const isOpen = connection.state === WebSocketState.OPEN;
  // Only KERNEL_DISCONNECTED is recoverable by a retry. KERNEL_STARTUP_ERROR
  // would deterministically fail the same way.
  const canReconnect =
    isClosed && connection.code === WebSocketClosedReason.KERNEL_DISCONNECTED;

  return (
    <>
      {isClosed && <NoiseBackground />}
      <div
        className={cn(
          "z-50 top-4 left-4",
          mode === "read" ? "fixed" : "absolute",
        )}
      >
        {isOpen && isRunning && !hideRunningIndicator && <RunningIcon />}
        {/* When the notebook header bar is shown it carries its own status
            dot, so the floating icon (which collides with the mo.sidebar
            menu at the same corner) only renders for bar-less modes. */}
        {isClosed && !hideRunningIndicator && (
          <DisconnectedIcon
            onReconnect={canReconnect ? onReconnect : undefined}
          />
        )}
      </div>
    </>
  );
};

const topLeftStatus = "print:hidden pointer-events-auto hover:cursor-pointer";

const DisconnectedIcon: React.FC<{ onReconnect?: () => void }> = ({
  onReconnect,
}) => {
  const disabled = !onReconnect;
  return (
    <Tooltip
      content={
        disabled ? "App disconnected" : "App disconnected — click to reconnect"
      }
    >
      {/* Wrapper span keeps the tooltip reachable when the button is
          disabled — a disabled <button> swallows pointer events. */}
      <span tabIndex={disabled ? 0 : -1}>
        <button
          type="button"
          className={cn(topLeftStatus, "bg-transparent border-0 p-0")}
          aria-label={disabled ? "App disconnected" : "Reconnect to app"}
          data-testid="disconnected-indicator"
          onClick={onReconnect}
          disabled={disabled}
        >
          <UnlinkIcon className="w-[25px] h-[25px] text-error" />
        </button>
      </span>
    </Tooltip>
  );
};

const RunningIcon = () => {
  const scratchpadOnly = useAtomValue(onlyScratchpadIsRunningAtom);
  const tooltip = scratchpadOnly
    ? "Scratchpad is running"
    : "Jump to running cell";

  return (
    <Tooltip content={tooltip} side="right">
      <div
        className={topLeftStatus}
        data-testid="loading-indicator"
        onClick={scratchpadOnly ? undefined : notebookScrollToRunning}
      >
        <HourglassIcon className="running-app-icon" size={30} strokeWidth={1} />
      </div>
    </Tooltip>
  );
};

// Skies' flat dark language shows a plain veil on disconnect, not marimo's
// rainbow gradient + noise backdrop.
const NoiseBackground = () => (
  <div className="fixed inset-0 -z-10 bg-background/60" />
);
