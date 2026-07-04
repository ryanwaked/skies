/* Copyright 2026 Marimo. All rights reserved. */

import { FileTextIcon } from "lucide-react";
import React from "react";
import { ClearButton } from "@/components/buttons/clear-button";
import { useCellActions, useCellLogs } from "@/core/cells/cells";
import { type CellLog, formatLogTimestamp } from "@/core/cells/logs";
import { cn } from "@/utils/cn";
import { CellLink } from "../../links/cell-link";
import { PanelEmptyState } from "./empty-state";

interface Props {
  className?: string;
  logs: CellLog[];
}

const LogsPanel: React.FC = () => {
  const logs = useCellLogs();
  const { clearLogs } = useCellActions();

  if (logs.length === 0) {
    return (
      <PanelEmptyState
        title="No logs"
        description={
          <span>
            <code className="border rounded-[3px] px-1 font-code">stdout</code>{" "}
            and{" "}
            <code className="border rounded-[3px] px-1 font-code">stderr</code>{" "}
            logs will appear here.
          </span>
        }
        icon={<FileTextIcon />}
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden">
      <div className="flex flex-row justify-start px-2 py-1">
        <ClearButton dataTestId="clear-logs-button" onClick={clearLogs} />
      </div>
      <LogViewer logs={logs}  />
    </div>
  );
};

export default LogsPanel;

export const LogViewer: React.FC<Props> = ({ logs, className }) => {
  const hover =
    "opacity-70 group-hover:bg-[rgba(63,66,87,0.2)] group-hover:opacity-100";
  return (
    <div className={cn("flex flex-col", className)}>
      <pre className="grid text-xs font-code gap-1 whitespace-break-spaces align-left">
        <div
          className="grid grid-cols-[30px_1fr]"
          style={{ whiteSpace: "pre-wrap" }}
        >
          {logs.map((log, index) => (
            <div key={index} className="contents group">
              <span className={cn(hover, "text-right col-span-1 py-1 pr-1")}>
                {index + 1}
              </span>
              <span className={cn(hover, "px-2 flex gap-x-1.5 py-1 flex-wrap")}>
                {formatLog(log)}
              </span>
            </div>
          ))}
        </div>
      </pre>
    </div>
  );
};

function formatLog(log: CellLog) {
  const timestamp = formatLogTimestamp(log.timestamp);

  const color = levelColor[log.level];
  const level = log.level.toUpperCase();

  return (
    <>
      <span className="shrink-0 text-muted-foreground">[{timestamp}]</span>
      <span className={cn("shrink-0", color)}>{level}</span>
      <span className="shrink-0 text-muted-foreground">
        (<CellLink cellId={log.cellId} />)
      </span>
      {log.message}
    </>
  );
}

const levelColor: Record<CellLog["level"], string> = {
  stdout: "text-success",
  stderr: "text-error",
};
