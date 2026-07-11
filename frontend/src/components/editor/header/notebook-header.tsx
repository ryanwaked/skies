/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import { LoaderCircleIcon, Undo2Icon } from "lucide-react";
import type { JSX } from "react";
import { ConfigButton } from "@/components/app-config/app-config-button";
import { RunAllSplitButton } from "@/components/editor/controls/run-all-button";
import { FilenameForm } from "@/components/editor/header/filename-form";
import { useImperativeModal } from "@/components/modal/ImperativeModal";
import { ScrollProgress } from "@/components/skies/scroll-progress";
import { ShareStaticNotebookModal } from "@/components/static-html/share-modal";
import { Tooltip } from "@/components/ui/tooltip";
import { notebookScrollToRunning } from "@/core/cells/actions";
import {
  canUndoDeletesAtom,
  notebookIsRunningAtom,
  notebookQueuedOrRunningCountAtom,
  undoLabelAtom,
  useCellActions,
} from "@/core/cells/cells";
import { useTogglePresenting } from "@/core/layout/useTogglePresenting";
import { viewStateAtom } from "@/core/mode";
import { connectionAtom } from "@/core/network/connection";
import { useFilename } from "@/core/saving/filename";
import { SaveComponent } from "@/core/saving/save-component";
import {
  getConnectionTooltip,
  isAppInteractionDisabled,
} from "@/core/websocket/connection-utils";
import { type ConnectionStatus, WebSocketState } from "@/core/websocket/types";
import { cn } from "@/utils/cn";
import { Paths } from "@/utils/paths";
import { NotebookMenuDropdown } from "../controls/notebook-menu-dropdown";
import { NotebookStatusTicks } from "./notebook-status-ticks";
import { ShutdownButton } from "../controls/shutdown-button";
import { VersionHistoryButton } from "../controls/version-history-button";
import { LayoutSelect } from "../renderers/layout-select";

/**
 * Slim top bar for the notebook editor: notebook menu, editable title,
 * connection status, notebook/app-builder switch, and share/publish actions.
 *
 * Spans the full viewport width (edge to edge, above the icon rail), so it
 * reads its own state from atoms rather than taking props from EditApp.
 */
export const NotebookHeader = (): JSX.Element => {
  const filename = useFilename();
  const connection = useAtomValue(connectionAtom);
  const { mode } = useAtomValue(viewStateAtom);
  const closed = connection.state === WebSocketState.CLOSED;
  const disabled = isAppInteractionDisabled(connection.state);
  const connectionTooltip = disabled
    ? getConnectionTooltip(connection.state)
    : undefined;

  return (
    <div
      data-testid="notebook-header"
      className="skies-topbar relative flex h-[44px] w-full shrink-0 items-center gap-1 border-b border-border bg-[var(--nav-solid)] pl-2 pr-3 print:hidden"
    >
      {/* The scroll-progress hairline tracks the #App scroll container, which
          collapses in present mode (the deck manages its own inner scroll).
          Hide it there so it doesn't sit empty at the left edge. */}
      {mode !== "present" && <ScrollProgress />}

      {!closed && (
        <NotebookMenuDropdown disabled={disabled} tooltip={connectionTooltip} />
      )}

      <div className="flex min-w-0 shrink items-center">
        <HeaderBreadcrumb filename={filename} />
        <FilenameForm filename={filename} />
      </div>

      {/* Hairline divider mirroring the right-side action separators (the
          chevron here was a dead affordance). */}
      <div className="mx-1 h-[18px] w-px shrink-0 bg-border" />

      <HeaderStatusIndicator connection={connection} />

      {!closed && <NotebookStatusTicks />}

      <ModeSwitch />

      <div className="flex-1" />

      <div className="flex shrink-0 items-center gap-1">
        {mode === "present" && <LayoutSelect />}

        {!closed && <TopBarUndo />}
        {!closed && <QueuedCellsIndicator />}
        {!closed && <RunAllSplitButton />}

        <div className="mx-1 h-[18px] w-px bg-border" />

        <ShareButton />

        {!closed && (
          <>
            <div className="mx-1 h-[18px] w-px bg-border" />
            <SaveComponent kioskMode={false} />
            <VersionHistoryButton
              disabled={disabled}
              tooltip={connectionTooltip ?? "Version history"}
            />
            <ConfigButton disabled={disabled} tooltip={connectionTooltip} />
            <ShutdownButton
              description="This will terminate the Python kernel. You'll lose all data that's in memory."
              disabled={disabled}
              tooltip={connectionTooltip}
            />
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Muted path context before the editable filename (Hex breadcrumb voice):
 * the parent directory's name and a separator, 14px/400. Display-only.
 */
const HeaderBreadcrumb = ({ filename }: { filename: string | null }) => {
  if (!filename) {
    return null;
  }
  const dir = Paths.basename(Paths.dirname(filename));
  if (!dir) {
    return null;
  }
  return (
    <span className="hidden shrink-0 items-center pl-1 text-sm text-muted-foreground sm:flex">
      {dir}
      <span className="px-1.5 text-[var(--foreground-dim)]">/</span>
    </span>
  );
};

/**
 * Subtle connection/run-state dot shown right of the title. Clicking it while
 * cells are running jumps to the running cell.
 */
const HeaderStatusIndicator = ({
  connection,
}: {
  connection: ConnectionStatus;
}) => {
  const isRunning = useAtomValue(notebookIsRunningAtom);
  const isOpen = connection.state === WebSocketState.OPEN;
  const isClosed = connection.state === WebSocketState.CLOSED;
  const running = isOpen && isRunning;

  const label = isClosed
    ? "Disconnected"
    : running
      ? "Running — jump to running cell"
      : isOpen
        ? "Connected"
        : "Connecting…";

  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        data-testid="header-status-indicator"
        onClick={running ? notebookScrollToRunning : undefined}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-[3px]",
          running ? "cursor-pointer" : "cursor-default",
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            isClosed && "bg-(--error)",
            running && "skies-ping bg-(--action-foreground)",
            isOpen && !running && "bg-(--success) opacity-60",
            !isOpen && !isClosed && "bg-(--muted-foreground)",
          )}
          style={
            running
              ? { ["--ping-color" as string]: "var(--action-foreground)" }
              : undefined
          }
        />
      </button>
    </Tooltip>
  );
};

/**
 * Segmented control switching between the notebook editor and marimo's
 * present mode (the closest analog of an "app" view).
 */
const ModeSwitch = () => {
  const { mode } = useAtomValue(viewStateAtom);
  const togglePresenting = useTogglePresenting();
  const isPresenting = mode === "present";

  return (
    <div
      role="tablist"
      aria-label="Notebook view"
      data-testid="notebook-mode-switch"
      // Inline in the bar's flow (the old absolutely-centered group collided
      // with the right-hand actions at narrow widths). Site nav-link voice:
      // quiet text with the copper-into-blue trace underline when active.
      className="ml-3 flex h-full shrink-0 items-stretch gap-1"
    >
      <ModeTab
        active={!isPresenting}
        label="Notebook"
        onSelect={() => {
          if (isPresenting) {
            togglePresenting();
          }
        }}
      />
      <ModeTab
        active={isPresenting}
        label="App builder"
        onSelect={() => {
          if (!isPresenting) {
            togglePresenting();
          }
        }}
      />
    </div>
  );
};

const ModeTab = ({
  active,
  label,
  onSelect,
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
}) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    data-testid={`notebook-mode-tab-${label}`}
    onClick={onSelect}
    className={cn(
      "skies-mode-tab flex items-center px-[10px] text-[13.5px] font-normal transition-colors",
      active
        ? "text-foreground"
        : "text-muted-foreground hover:text-foreground",
    )}
  >
    {label}
  </button>
);

/**
 * Undo the last cell deletion, shown next to Run all when available. marimo
 * has no notebook-level redo (code edits redo per-cell via the editor's own
 * ⇧⌘Z), so only undo lives here.
 */
const TopBarUndo = () => {
  const undoAvailable = useAtomValue(canUndoDeletesAtom);
  const undoLabel = useAtomValue(undoLabelAtom);
  const { undoDeleteCell } = useCellActions();
  if (!undoAvailable) {
    return null;
  }
  return (
    <Tooltip content={undoLabel}>
      <button
        type="button"
        aria-label="Undo delete cell"
        data-testid="header-undo-button"
        onClick={undoDeleteCell}
        className="flex h-[24px] w-[24px] items-center justify-center rounded-[3px] text-muted-foreground transition-colors hover:bg-[var(--hover-wash)] hover:text-foreground"
      >
        <Undo2Icon className="h-[16px] w-[16px]" strokeWidth={1.5} />
      </button>
    </Tooltip>
  );
};

/**
 * Live count of queued/running cells, shown left of Run all. Mirrors the
 * split button's tinted-pill geometry but in the amber `action-foreground`
 * token so in-progress work reads distinct from the sky-blue run control.
 * Renders nothing when the kernel is idle (the Run all button carries the
 * running spinner on its own).
 */
const QueuedCellsIndicator = () => {
  const count = useAtomValue(notebookQueuedOrRunningCountAtom);
  if (count === 0) {
    return null;
  }
  return (
    <Tooltip content={`${count} cell${count > 1 ? "s" : ""} queued or running`}>
      <div
        data-testid="header-queued-cells-indicator"
        aria-label={`${count} cells queued or running`}
        className="flex h-[28px] items-center gap-1.5 rounded-[3px] bg-action-foreground/[0.14] px-[8px] text-[12px] font-medium tabular-nums text-action-foreground"
      >
        <LoaderCircleIcon
          className="h-[14px] w-[14px] animate-spin"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        {count}
      </div>
    </Tooltip>
  );
};

/** Ghost share button; opens marimo's "Publish HTML to web" dialog. */
const ShareButton = () => {
  const { openModal, closeModal } = useImperativeModal();

  return (
    <Tooltip content="Publish HTML to web">
      <button
        type="button"
        data-testid="header-share-button"
        onClick={() =>
          openModal(<ShareStaticNotebookModal onClose={closeModal} />)
        }
        className="skies-cta flex h-[28px] items-center rounded-[3px] px-[10px] py-[5px] text-[13px] font-medium"
      >
        Share
      </button>
    </Tooltip>
  );
};
