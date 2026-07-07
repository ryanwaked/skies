/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import { ChevronDownIcon, LoaderCircleIcon, PlayIcon } from "lucide-react";
import { useRunAllCells, useRunStaleCells } from "@/components/editor/cell/useRunCells";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { notebookIsRunningAtom } from "@/core/cells/cells";
import { canInteractWithAppAtom } from "@/core/network/connection";
import { useRequestClient } from "@/core/network/requests";
import { cn } from "@/utils/cn";
import { useShouldShowInterrupt } from "../cell/useShouldShowInterrupt";

/** Shared tint for both halves of the split control: the Skies active
 * treatment — sky-blue ink on a soft sky-blue wash, never a solid fill. */
const splitTint =
  "bg-primary/[0.14] text-primary transition-colors hover:bg-primary/[0.22]";

/**
 * Skies "Run all" split button: a 24px main half that runs stale cells
 * plus a 24x24 chevron half opening a menu with "Run all cells" and
 * "Interrupt kernel". Lives in the notebook top bar (it used to float
 * over the first cell and content scrolled through its translucent wash).
 */
export const RunAllSplitButton = () => {
  const canInteractWithApp = useAtomValue(canInteractWithAppAtom);
  const running = useAtomValue(notebookIsRunningAtom);
  const runStaleCells = useRunStaleCells();
  const runAllCells = useRunAllCells();
  const { sendInterrupt } = useRequestClient();
  // Only offer interrupt after 200ms of running to avoid flickering.
  const showInterrupt = useShouldShowInterrupt(running);

  const mainDisabled = !canInteractWithApp || running;

  return (
    <div
      data-testid="notebook-run-toolbar"
      className="flex items-center gap-px shrink-0"
    >
      <Tooltip content={running ? "Running…" : "Run all cells"}>
        <button
          type="button"
          data-testid="run-button"
          onClick={() => runAllCells()}
          disabled={mainDisabled}
          className={cn(
            "flex h-[24px] items-center gap-1.5 rounded-l-[3px] rounded-r-none px-[8px] py-[4px] text-[12px] font-medium",
            splitTint,
            mainDisabled && "cursor-default hover:bg-primary/[0.14]",
            !canInteractWithApp && "opacity-50",
          )}
        >
          {running ? (
            <LoaderCircleIcon
              className="h-[16px] w-[16px] animate-spin"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          ) : (
            <PlayIcon
              className="h-[16px] w-[16px]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          )}
          Run all
        </button>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild={true}>
          <button
            type="button"
            aria-label="Run options"
            data-testid="run-all-menu-trigger"
            disabled={!canInteractWithApp}
            className={cn(
              "flex h-[24px] w-[24px] items-center justify-center rounded-r-[3px] rounded-l-none",
              splitTint,
              !canInteractWithApp && "opacity-50 hover:bg-primary/[0.07]",
            )}
          >
            <ChevronDownIcon
              className="h-[16px] w-[16px]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            data-testid="run-stale-cells-menu-item"
            disabled={!canInteractWithApp || running}
            onSelect={() => runStaleCells()}
          >
            Run stale cells
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="interrupt-kernel-menu-item"
            disabled={!showInterrupt}
            onSelect={() => sendInterrupt()}
          >
            Interrupt kernel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
