/* Copyright 2026 Marimo. All rights reserved. */

import { ExternalLinkIcon, PowerOffIcon } from "lucide-react";
import type React from "react";
import { use } from "react";
import { MarkdownIcon } from "@/components/editor/cell/code/icons";
import { useImperativeModal } from "@/components/modal/ImperativeModal";
import { AlertDialogDestructiveAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { getSessionId } from "@/core/kernel/session";
import { useRequestClient } from "@/core/network/requests";
import { assertExists } from "@/utils/assertExists";
import { Maps } from "@/utils/maps";
import { Paths } from "@/utils/paths";
import { asURL } from "@/utils/url";
import { RunningNotebooksContext } from "./state";

/** Consistent tab target so we open in the same tab when clicking on the same notebook. */
export function tabTarget(path: string) {
  return `${getSessionId()}-${encodeURIComponent(path)}`;
}

/** Convert a workspace tree path into a path relative to the workspace root. */
export function relativeToRoot(path: string, root: string): string {
  return path.startsWith(root) && Paths.isAbsolute(path)
    ? Paths.rest(path, root)
    : path;
}

/** Shared inner-row styling for notebook rows (workspace tree + collections). */
export const NOTEBOOK_ROW_ITEM_CLASS =
  "flex items-center pl-1 cursor-pointer hover:bg-accent/50 hover:text-accent-foreground rounded-l flex-1 overflow-hidden h-full pr-3 gap-2";

/**
 * A single notebook row: file icon, name, an `actions` slot (dropdown menu),
 * a fixed-width shutdown slot, and an external-link affordance. Used by both
 * the workspace file tree and home-page collections so the row markup stays
 * in one place.
 */
export const NotebookRowLink: React.FC<{
  /** Path relative to the workspace root; used for the href and session lookups. */
  relativePath: string;
  name: string;
  icon: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ relativePath, name, icon, actions }) => {
  const isMarkdown =
    relativePath.endsWith(".md") || relativePath.endsWith(".qmd");

  return (
    <a
      className={NOTEBOOK_ROW_ITEM_CLASS}
      href={asURL(`?file=${encodeURIComponent(relativePath)}`).toString()}
      target={tabTarget(relativePath)}
    >
      {icon}
      <span className="flex-1 overflow-hidden text-ellipsis">
        {name}
        {isMarkdown && <MarkdownIcon className="ml-2 inline opacity-80" />}
      </span>

      {actions}
      {/*
        Trailing action slots. Using a fixed-width row here (rather than
        conditionally rendered inline elements) keeps every row's right
        edge aligned even though any individual slot may be empty.
      */}
      <div className="w-8 h-8 flex items-center justify-center shrink-0">
        <SessionShutdownButton filePath={relativePath} />
      </div>
      <ExternalLinkIcon
        size={20}
        className="group-hover:opacity-100 opacity-0 text-primary shrink-0"
      />
    </a>
  );
};

export const SessionShutdownButton: React.FC<{ filePath: string }> = ({
  filePath,
}) => {
  const { openConfirm, closeModal } = useImperativeModal();
  const { shutdownSession } = useRequestClient();
  const { runningNotebooks, setRunningNotebooks } = use(
    RunningNotebooksContext,
  );
  if (!runningNotebooks.has(filePath)) {
    return null;
  }
  return (
    <Tooltip content="Shutdown">
      <Button
        size={"icon"}
        variant="outline"
        className="opacity-80 hover:opacity-100 text-destructive border-destructive hover:border-destructive hover:text-destructive bg-background hover:bg-destructive/10"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          openConfirm({
            title: "Shutdown",
            description:
              "This will terminate the Python kernel. You'll lose all data that's in memory.",
            variant: "destructive",
            confirmAction: (
              <AlertDialogDestructiveAction
                onClick={() => {
                  const ids = runningNotebooks.get(filePath);
                  assertExists(ids?.sessionId);
                  shutdownSession({
                    sessionId: ids.sessionId,
                  }).then((response) => {
                    setRunningNotebooks(
                      Maps.keyBy(response.files, (file) => file.path),
                    );
                  });
                  closeModal();
                  toast({
                    description: "Notebook has been shutdown.",
                  });
                }}
                aria-label="Confirm Shutdown"
              >
                Shutdown
              </AlertDialogDestructiveAction>
            ),
          });
        }}
      >
        <PowerOffIcon size={14} />
      </Button>
    </Tooltip>
  );
};
