/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import {
  EditIcon,
  LayoutTemplateIcon,
  PlayIcon,
  SquareIcon,
  Undo2Icon,
} from "lucide-react";
import type { JSX } from "react";
import { KeyboardShortcuts } from "@/components/editor/controls/keyboard-shortcuts";
import { Button } from "@/components/editor/inputs/Inputs";
import { FindReplace } from "@/components/find-replace/find-replace";
import type { AppConfig } from "@/core/config/config-schema";
import { canInteractWithAppAtom } from "@/core/network/connection";
import { SaveComponent } from "@/core/saving/save-component";
import { WebSocketState } from "@/core/websocket/types";
import { cn } from "@/utils/cn";
import { Functions } from "@/utils/functions";
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
  const needsRun = useAtomValue(needsRunAtom);
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
          <div className="flex flex-col gap-2 items-center">
            {undoControl}
            {!closed && (
              <StopControlButton running={running} onInterrupt={onInterrupt} />
            )}
            {!closed && <RunControlButton needsRun={needsRun} onRun={onRun} />}
          </div>
        </HideInKioskMode>
      </div>
    </>
  );
};

const RunControlButton = ({
  needsRun,
  onRun,
}: {
  needsRun: boolean;
  onRun: () => void;
}) => {
  const canInteractWithApp = useAtomValue(canInteractWithAppAtom);

  if (needsRun) {
    return (
      <Tooltip content={renderShortcut("global.runStale")}>
        <Button
          data-testid="run-button"
          size="medium"
          color="yellow"
          shape="circle"
          onClick={onRun}
          disabled={!canInteractWithApp}
        >
          <PlayIcon strokeWidth={1.5} size={16} />
        </Button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content="Nothing to run">
      <Button
        data-testid="run-button"
        className={"inactive-button"}
        color="disabled"
        size="medium"
        shape="circle"
        disabled={!canInteractWithApp}
      >
        <PlayIcon strokeWidth={1.5} size={16} />
      </Button>
    </Tooltip>
  );
};

const StopControlButton = ({
  running,
  onInterrupt,
}: {
  running: boolean;
  onInterrupt: () => void;
}) => {
  // Show the interrupt button after 200ms to avoid flickering.
  const showInterrupt = useShouldShowInterrupt(running);

  return (
    <Tooltip content={renderShortcut("global.interrupt")}>
      <Button
        className={cn(!showInterrupt && "inactive-button")}
        data-testid="interrupt-button"
        size="medium"
        color={showInterrupt ? "yellow" : "disabled"}
        shape="circle"
        onClick={showInterrupt ? onInterrupt : Functions.NOOP}
      >
        <SquareIcon strokeWidth={1.5} size={16} />
      </Button>
    </Tooltip>
  );
};

const bottomRightControls =
  "absolute bottom-5 right-5 flex flex-col gap-2 items-center print:hidden pointer-events-auto z-30";
