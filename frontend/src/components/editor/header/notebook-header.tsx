/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import {
  ChevronDownIcon,
  LayoutGridIcon,
  LayoutTemplateIcon,
  MessageSquareTextIcon,
  UserPlusIcon,
} from "lucide-react";
import type { JSX, ReactNode } from "react";
import { ConfigButton } from "@/components/app-config/app-config-button";
import { FilenameForm } from "@/components/editor/header/filename-form";
import { useImperativeModal } from "@/components/modal/ImperativeModal";
import { ShareStaticNotebookModal } from "@/components/static-html/share-modal";
import { Tooltip } from "@/components/ui/tooltip";
import { notebookScrollToRunning } from "@/core/cells/actions";
import { notebookIsRunningAtom } from "@/core/cells/cells";
import { useTogglePresenting } from "@/core/layout/useTogglePresenting";
import { viewStateAtom } from "@/core/mode";
import { connectionAtom } from "@/core/network/connection";
import { useFilename } from "@/core/saving/filename";
import {
  getConnectionTooltip,
  isAppInteractionDisabled,
} from "@/core/websocket/connection-utils";
import { type ConnectionStatus, WebSocketState } from "@/core/websocket/types";
import { cn } from "@/utils/cn";
import { NotebookMenuDropdown } from "../controls/notebook-menu-dropdown";
import { ShutdownButton } from "../controls/shutdown-button";
import { LayoutSelect } from "../renderers/layout-select";

const hoverGhost = "hover:bg-[rgba(63,66,87,0.2)]";

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
      className="hex-topbar flex h-10 w-full shrink-0 items-center gap-1 border-b border-border bg-background pl-2 pr-3 print:hidden"
    >
      {!closed && (
        <NotebookMenuDropdown disabled={disabled} tooltip={connectionTooltip} />
      )}

      <div className="flex min-w-0 shrink items-center">
        <FilenameForm filename={filename} />
        <ChevronDownIcon
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </div>

      <HeaderStatusIndicator connection={connection} />

      <ModeSwitch />

      <div className="flex-1" />

      <div className="flex shrink-0 items-center gap-1">
        {mode === "present" && <LayoutSelect />}

        <Tooltip content="Comments — not wired up">
          <button
            type="button"
            aria-label="Comments"
            data-testid="header-comments-button"
            className={cn(
              "flex size-7 items-center justify-center rounded-[3px] text-muted-foreground transition-colors hover:text-foreground",
              hoverGhost,
            )}
          >
            <MessageSquareTextIcon className="size-4" strokeWidth={1.8} />
          </button>
        </Tooltip>

        <ShareButton />

        <Tooltip content="Not wired up">
          <button
            type="button"
            data-testid="header-publish-button"
            className={cn(
              "flex h-7 items-center rounded-[3px] border border-input px-2.5 text-sm text-foreground transition-colors",
              hoverGhost,
            )}
          >
            Publish app
          </button>
        </Tooltip>

        {!closed && (
          <>
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
            running && "bg-(--action-foreground) animate-pulse",
            isOpen && !running && "bg-(--success) opacity-60",
            !isOpen && !isClosed && "bg-(--muted-foreground)",
          )}
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
      className="ml-3 flex shrink-0 items-center gap-0.5 rounded-[3px] bg-card p-0.5"
    >
      <ModeTab
        active={!isPresenting}
        label="Notebook"
        icon={<LayoutGridIcon className="size-3.5" strokeWidth={1.8} />}
        onSelect={() => {
          if (isPresenting) {
            togglePresenting();
          }
        }}
      />
      <ModeTab
        active={isPresenting}
        label="App builder"
        icon={<LayoutTemplateIcon className="size-3.5" strokeWidth={1.8} />}
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
  icon,
  onSelect,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
}) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    data-testid={`notebook-mode-tab-${label}`}
    onClick={onSelect}
    className={cn(
      "flex h-7 items-center gap-1.5 rounded-[3px] px-2 text-sm font-normal transition-colors",
      active
        ? "bg-primary/[0.07] text-primary"
        : "text-foreground hover:bg-[rgba(63,66,87,0.2)]",
    )}
  >
    {icon}
    {label}
  </button>
);

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
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-[3px] px-2.5 text-sm font-normal text-(--success) transition-colors",
          "bg-[rgba(67,213,157,0.07)] hover:bg-[rgba(67,213,157,0.14)]",
        )}
      >
        <UserPlusIcon className="size-4" strokeWidth={1.8} />
        Share
      </button>
    </Tooltip>
  );
};
