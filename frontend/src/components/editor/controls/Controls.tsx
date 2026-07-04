/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import {
  ChevronDownIcon,
  EditIcon,
  LayoutTemplateIcon,
  LoaderCircleIcon,
  PlayIcon,
  Undo2Icon,
} from "lucide-react";
import type { JSX } from "react";
import { KeyboardShortcuts } from "@/components/editor/controls/keyboard-shortcuts";
import { Button } from "@/components/editor/inputs/Inputs";
import { FindReplace } from "@/components/find-replace/find-replace";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRunAllCells } from "@/components/editor/cell/useRunCells";
import type { AppConfig } from "@/core/config/config-schema";
import { canInteractWithAppAtom } from "@/core/network/connection";
import { SaveComponent } from "@/core/saving/save-component";
import { WebSocketState } from "@/core/websocket/types";
import { cn } from "@/utils/cn";
import {
  canUndoDeletesAtom,
  needsRunAtom,
  undoLabelAtom,
  useCellActions,
} from "../../../core/cells/cells";
import { renderShortcut } from "../../shortcuts/renderShortcut";
import { Tooltip } from "../../ui/tooltip";
import { useShouldShowInterrupt } from "../cell/useShouldShowInterrupt";
import { HideInKioskMode } from "../kiosk-mode";
import { CommandPaletteButton } from "./command-palette-button";

interface ControlsProps {
  presenting: boolean;
  onTogglePresenting: () => void;
  onInterrupt: () => void;
  onRun: () => void;
  connectionState: WebSocketState;
  running: boolean;
  appConfig: AppConfig;
}

export const Controls = ({
  presenting,
  onTogglePresenting,
  onInterrupt,
  onRun,
  connectionState,
  running,
}: ControlsProps): JSX.Element => {
  const undoAvailable = useAtomValue(canUndoDeletesAtom);
  const undoLabel = useAtomValue(undoLabelAtom);
  const { undoDeleteCell } = useCellActions();
  const closed = connectionState === WebSocketState.CLOSED;

  let undoControl: JSX.Element | null = null;
  if (!closed && undoAvailable) {
    undoControl = (
      <Tooltip content={undoLabel}>
        <Button
          data-testid="undo-delete-cell"
          size="medium"
          color="hint-green"
          shape="circle"
          onClick={undoDeleteCell}
        >
          <Undo2Icon size={16} strokeWidth={1.5} />
        </Button>
      </Tooltip>
    );
  }

  return (
    <>
      {!presenting && <FindReplace />}

      {/* The notebook menu, config, shutdown, and layout controls moved into
          the NotebookHeader top bar. */}

      {/* Hex-style Run-all split button, pinned top-right inside the notebook
          area (just below the 40px top bar). */}
      {!presenting && !closed && (
        <div
          data-testid="notebook-run-toolbar"
          className="absolute top-[8px] right-[16px] z-30 print:hidden pointer-events-auto"
        >
          <HideInKioskMode>
            <RunAllSplitButton
              running={running}
              onRun={onRun}
              onInterrupt={onInterrupt}
            />
          </HideInKioskMode>
        </div>
      )}

      <div
        data-testid="chrome-controls-bottom-right"
        className={cn(bottomRightControls)}
      >
        <HideInKioskMode>
          <SaveComponent kioskMode={false} />
        </HideInKioskMode>

        <Tooltip content={renderShortcut("global.hideCode")}>
          <Button
            data-testid="hide-code-button"
            id="preview-button"
            shape="rectangle"
            color="hint-green"
            onClick={onTogglePresenting}
          >
            {presenting ? (
              <EditIcon strokeWidth={1.5} size={18} />
            ) : (
              <LayoutTemplateIcon strokeWidth={1.5} size={18} />
            )}
          </Button>
        </Tooltip>

        <CommandPaletteButton />
        <KeyboardShortcuts />

        <div />

        <HideInKioskMode>
          <div className="flex flex-col gap-2 items-center">{undoControl}</div>
        </HideInKioskMode>
      </div>
    </>
  );
};

/** Shared tint for both halves of the split control (Hex ground truth:
 * #f5c0c0 on rgba(245,192,192,0.07)). */
const splitTint =
  "bg-primary/[0.07] text-primary transition-colors hover:bg-primary/[0.14]";

/**
 * Hex-style "Run all" split button: a 24px main half that runs stale cells
 * plus a 24x24 chevron half opening a menu with "Run all cells" and
 * "Interrupt kernel".
 */
const RunAllSplitButton = ({
  running,
  onRun,
  onInterrupt,
}: {
  running: boolean;
  onRun: () => void;
  onInterrupt: () => void;
}) => {
  const canInteractWithApp = useAtomValue(canInteractWithAppAtom);
  const needsRun = useAtomValue(needsRunAtom);
  const runAllCells = useRunAllCells();
  // Only offer interrupt after 200ms of running to avoid flickering.
  const showInterrupt = useShouldShowInterrupt(running);

  const mainDisabled = !canInteractWithApp || running;

  return (
    <div className="flex items-center gap-px">
      <Tooltip
        content={
          running
            ? "Running…"
            : needsRun
              ? renderShortcut("global.runStale")
              : "Nothing to run"
        }
      >
        <button
          type="button"
          data-testid="run-button"
          onClick={onRun}
          disabled={mainDisabled}
          className={cn(
            "flex h-[24px] items-center gap-1.5 rounded-l-[3px] rounded-r-none px-[8px] py-[4px] text-[12px] font-normal",
            splitTint,
            mainDisabled && "cursor-default hover:bg-primary/[0.07]",
            !canInteractWithApp && "opacity-50",
            !needsRun && !running && "opacity-70",
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
            data-testid="run-all-cells-menu-item"
            disabled={!canInteractWithApp || running}
            onSelect={() => runAllCells()}
          >
            Run all cells
          </DropdownMenuItem>
          <DropdownMenuItem
            data-testid="interrupt-kernel-menu-item"
            disabled={!showInterrupt}
            onSelect={() => onInterrupt()}
          >
            Interrupt kernel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const bottomRightControls =
  "absolute bottom-5 right-5 flex flex-col gap-2 items-center print:hidden pointer-events-auto z-30";
