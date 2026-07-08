/* Copyright 2026 Marimo. All rights reserved. */

import { HistoryIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { useLocale, VisuallyHidden } from "react-aria";
import { Button as EditorButton } from "@/components/editor/inputs/Inputs";
import { ReadonlyDiff } from "@/components/editor/code/readonly-diff";
import { AlertDialogDestructiveAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Command, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { useImperativeModal } from "@/components/modal/ImperativeModal";
import { useRequestClient } from "@/core/network/requests";
import type { GitCommitInfo } from "@/core/network/types";
import { useAsyncData } from "@/hooks/useAsyncData";
import { timeAgo } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { PanelEmptyState } from "../chrome/panels/empty-state";

interface Props {
  disabled?: boolean;
  tooltip?: string;
}

/**
 * Top-bar entry point for the notebook's version history: every save
 * (manual or autosave) is snapshotted into a hidden per-notebook git repo;
 * this button opens a panel to browse, preview, and restore past versions.
 */
export const VersionHistoryButton: React.FC<Props> = ({
  disabled = false,
  tooltip = "Version history",
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild={true}>
        <EditorButton
          aria-label="Version history"
          data-testid="version-history-button"
          shape="circle"
          size="small"
          className="h-[27px] w-[27px]"
          disabled={disabled}
          color={disabled ? "disabled" : "hint-green"}
        >
          <Tooltip content={tooltip}>
            <HistoryIcon strokeWidth={1.8} />
          </Tooltip>
        </EditorButton>
      </DialogTrigger>
      <DialogContent className="w-[90vw] h-[85vh] overflow-hidden sm:max-w-4xl top-[6vh] p-0">
        <VisuallyHidden>
          <DialogTitle>Version history</DialogTitle>
        </VisuallyHidden>
        {/* Only mount (and fetch) while the dialog is actually open. */}
        {open && <VersionHistoryPanel onRestored={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
};

const VersionHistoryPanel: React.FC<{ onRestored: () => void }> = ({
  onRestored,
}) => {
  const { locale } = useLocale();
  const { getGitLog, getGitShow, sendGitCommit, sendGitRestore } =
    useRequestClient();
  const { openConfirm } = useImperativeModal();
  const [selectedHash, setSelectedHash] = useState<string>();
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const {
    data: log,
    status: logStatus,
    refetch: refetchLog,
  } = useAsyncData(() => getGitLog(), [getGitLog]);

  const commits = log?.commits ?? [];
  const selectedIndex = commits.findIndex(
    (c) => c.commitHash === selectedHash,
  );
  const selected = selectedIndex === -1 ? undefined : commits[selectedIndex];
  // Commits are newest-first, so the previous version of the selected
  // commit is simply the next entry in the list (or "empty" if it's the
  // oldest/first commit) — no separate diff endpoint needed.
  const previous = commits[selectedIndex + 1];

  const { data: selectedContent, status: contentStatus } = useAsyncData(
    async () => {
      if (!selected) {
        return { current: "", original: "" };
      }
      const [current, original] = await Promise.all([
        getGitShow({ commitHash: selected.commitHash }),
        previous
          ? getGitShow({ commitHash: previous.commitHash })
          : Promise.resolve({ content: "" }),
      ]);
      return {
        current: current.content ?? "",
        original: original.content ?? "",
      };
    },
    [selected?.commitHash, previous?.commitHash, getGitShow],
  );

  const handleCommit = async () => {
    setIsCommitting(true);
    try {
      const response = await sendGitCommit({
        message: commitMessage.trim() || "Manual save point",
      });
      if (response.success) {
        toast({ description: "Saved a new version." });
        setCommitMessage("");
        refetchLog();
      } else {
        toast({ variant: "danger", description: response.message ?? "Nothing to commit." });
      }
    } finally {
      setIsCommitting(false);
    }
  };

  const handleRestore = (commit: GitCommitInfo) => {
    openConfirm({
      title: "Restore this version?",
      description:
        "This replaces the notebook's current cells with the selected version. Unsaved changes since the last save will be lost.",
      variant: "destructive",
      confirmAction: (
        <AlertDialogDestructiveAction
          onClick={async () => {
            setIsRestoring(true);
            try {
              const response = await sendGitRestore({
                commitHash: commit.commitHash,
              });
              if (response.success) {
                toast({ description: "Restored." });
                onRestored();
              } else {
                toast({
                  variant: "danger",
                  description: response.message ?? "Could not restore that version.",
                });
              }
            } finally {
              setIsRestoring(false);
            }
          }}
          aria-label="Confirm restore"
        >
          Restore
        </AlertDialogDestructiveAction>
      ),
    });
  };

  if (logStatus === "pending" || logStatus === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-[13px] text-muted-foreground">Loading history…</span>
      </div>
    );
  }

  if (!log?.available) {
    return (
      <PanelEmptyState
        title="Version history isn't available"
        description="This needs git installed, and the notebook must be saved to a file first."
        icon={<HistoryIcon />}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <h2 className="text-[13px] font-medium">Version history</h2>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="flex w-[280px] shrink-0 flex-col border-r">
          <div className="flex items-center gap-1.5 border-b p-2">
            <Input
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCommit();
                }
              }}
              placeholder="Save a labeled version…"
              className="h-7 flex-1 text-[12px]"
            />
            <Button
              size="xs"
              variant="outline"
              disabled={isCommitting}
              onClick={handleCommit}
            >
              Save
            </Button>
          </div>
          {commits.length === 0 ? (
            <PanelEmptyState
              title="No versions yet"
              description="Versions appear here after you save the notebook."
            />
          ) : (
            <Command className="min-h-0 flex-1 rounded-none bg-card">
              <CommandList className="max-h-none flex-1 overflow-y-auto p-1">
                {commits.map((commit) => (
                  <CommandItem
                    key={commit.commitHash}
                    value={commit.commitHash}
                    onSelect={() => setSelectedHash(commit.commitHash)}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-[3px] py-1.5",
                      commit.commitHash === selectedHash &&
                        "bg-primary/[0.07] text-primary",
                    )}
                  >
                    <span className="truncate text-[12.5px]">
                      {commit.message}
                    </span>
                    <span className="font-mono text-[10.5px] text-[var(--foreground-dim)]">
                      {timeAgo(commit.date, locale)} · {commit.commitHash.slice(0, 7)}
                    </span>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col bg-card">
          {!selected ? (
            <PanelEmptyState description="Select a version to preview it." />
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                <span className="truncate text-[12.5px] text-muted-foreground">
                  {selected.message}
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={isRestoring}
                  onClick={() => handleRestore(selected)}
                >
                  <RotateCcwIcon strokeWidth={1.5} className="mr-1.5 h-3.5 w-3.5" />
                  Restore this version
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                {contentStatus === "success" && selectedContent && (
                  <ReadonlyDiff
                    original={selectedContent.original}
                    modified={selectedContent.current}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
