/* Copyright 2026 Marimo. All rights reserved. */

import { atom, useAtomValue } from "jotai";
import { notebookAtom } from "@/core/cells/cells";
import { isErrorMime } from "@/core/mime";
import { createDeepEqualAtom } from "@/core/state/jotai";
import { cn } from "@/utils/cn";

type TickState = "error" | "running" | "queued" | "stale" | "ran" | "idle";

/** Per-cell run state, in notebook order (Hex-style header state strip). */
const cellTickStatesAtom = createDeepEqualAtom(
  atom((get): TickState[] => {
    const { cellIds, cellRuntime, cellData } = get(notebookAtom);
    return cellIds.inOrderIds.map((cellId) => {
      const runtime = cellRuntime[cellId];
      const data = cellData[cellId];
      if (!runtime || !data) {
        return "idle";
      }
      if (isErrorMime(runtime.output?.mimetype)) {
        return "error";
      }
      if (runtime.status === "running") {
        return "running";
      }
      if (runtime.status === "queued") {
        return "queued";
      }
      if (data.edited || runtime.staleInputs) {
        return "stale";
      }
      if (runtime.runElapsedTimeMs != null || runtime.output != null) {
        return "ran";
      }
      return "idle";
    });
  }),
);

const MAX_TICKS = 16;

const TICK_COLOR: Record<TickState, string> = {
  error: "bg-(--error)",
  running: "bg-(--action-foreground) animate-pulse",
  queued: "bg-(--action-foreground) opacity-50",
  stale: "bg-(--action-foreground) opacity-40",
  ran: "bg-(--success) opacity-60",
  idle: "bg-border",
};

/**
 * Compact per-cell run-state strip for the top bar (the Hex "In Progress"
 * tick cluster): one 3×12px bar per cell, colored by state, capped at
 * MAX_TICKS with a mono overflow count.
 */
export const NotebookStatusTicks: React.FC = () => {
  const states = useAtomValue(cellTickStatesAtom);

  if (states.length === 0) {
    return null;
  }

  const shown = states.slice(0, MAX_TICKS);
  const overflow = states.length - shown.length;

  return (
    <div
      data-testid="notebook-status-ticks"
      className="ml-2 hidden shrink-0 items-center gap-[3px] md:flex"
      aria-hidden="true"
    >
      {shown.map((state, index) => (
        <span
          // Position is the identity here: ticks mirror notebook order.
          // oxlint-disable-next-line react/no-array-index-key
          key={index}
          className={cn("h-[12px] w-[3px] rounded-[1px]", TICK_COLOR[state])}
        />
      ))}
      {overflow > 0 && (
        <span className="pl-1 font-mono text-[10px] text-[var(--foreground-dim)]">
          +{overflow}
        </span>
      )}
    </div>
  );
};
