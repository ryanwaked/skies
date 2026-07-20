/* Copyright 2026 Marimo. All rights reserved. */

import {
  DownloadIcon,
  ExternalLinkIcon,
  Github,
  HistoryIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { useLocale, VisuallyHidden } from "react-aria";
import { Button as EditorButton } from "@/components/editor/inputs/Inputs";
import { ReadonlyDiff } from "@/components/editor/code/readonly-diff";
import { AlertDialogDestructiveAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useFilename } from "@/core/saving/filename";
import { useRequestClient } from "@/core/network/requests";
import type { GitCommitInfo } from "@/core/network/types";
import { useAsyncData } from "@/hooks/useAsyncData";
import { timeAgo } from "@/utils/dates";
import { Paths } from "@/utils/paths";
import { cn } from "@/utils/cn";
import { PanelEmptyState } from "../chrome/panels/empty-state";
import {
  PANEL_SEGMENTED_ITEM,
  PANEL_SEGMENTED_ITEM_ACTIVE,
  PANEL_SEGMENTED_ITEM_INACTIVE,
} from "../chrome/panels/panel-styles";

interface Props {
  disabled?: boolean;
  tooltip?: string;
}

/**
 * The save pipeline snapshots every plain save (⌘S and the debounced
 * autosave) with this exact message — see
 * `marimo/_session/notebook/file_manager.py`. It's the only discriminator the
 * backend records, so the timeline keys off it: anything else (a labeled
 * version from the Save box, "Manual save point", "Initial commit") is a
 * deliberate commit.
 */
const AUTOSAVE_MESSAGE = "Autosave";

const isAutosave = (commit: GitCommitInfo): boolean =>
  commit.message === AUTOSAVE_MESSAGE;

type HistoryTab = "commits" | "autosaves";

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

/** Slugify a notebook filename into a reasonable default GitHub repo name. */
function defaultRepoName(filename: string | null): string {
  if (!filename) {
    return "my-notebook";
  }
  const base = Paths.basename(filename).replace(/\.(py|md)$/, "");
  const slug = base
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  return slug || "my-notebook";
}

/** A segment in the timeline's Commits / Auto-saves toggle, with a count. */
const HistoryTabButton: React.FC<
  React.PropsWithChildren<{
    active: boolean;
    count: number;
    onClick: () => void;
  }>
> = ({ active, count, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      PANEL_SEGMENTED_ITEM,
      "flex items-center gap-1.5",
      active ? PANEL_SEGMENTED_ITEM_ACTIVE : PANEL_SEGMENTED_ITEM_INACTIVE,
    )}
  >
    {children}
    <span className="text-[10px] tabular-nums opacity-60">{count}</span>
  </button>
);

const VersionHistoryPanel: React.FC<{ onRestored: () => void }> = ({
  onRestored,
}) => {
  const { locale } = useLocale();
  const filename = useFilename();
  const privateCheckboxId = useId();
  const {
    getGitLog,
    getGitShow,
    sendGitCommit,
    sendGitRestore,
    sendGitPull,
    sendGitCreateRemote,
  } = useRequestClient();
  const { openConfirm } = useImperativeModal();
  const [tab, setTab] = useState<HistoryTab>("commits");
  const [selectedHash, setSelectedHash] = useState<string>();
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showCreateRepoForm, setShowCreateRepoForm] = useState(false);
  const [repoName, setRepoName] = useState(() => defaultRepoName(filename));
  const [repoIsPrivate, setRepoIsPrivate] = useState(true);
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const {
    data: log,
    status: logStatus,
    refetch: refetchLog,
  } = useAsyncData(() => getGitLog(), [getGitLog]);

  const commits = log?.commits ?? [];
  const selectedIndex = commits.findIndex((c) => c.commitHash === selectedHash);
  const selected = selectedIndex === -1 ? undefined : commits[selectedIndex];
  // Commits are newest-first, so the previous version of the selected
  // commit is simply the next entry in the list (or "empty" if it's the
  // oldest/first commit) — no separate diff endpoint needed. This stays keyed
  // to the FULL list so a diff always shows what changed vs. the true
  // chronological predecessor, regardless of the active tab's filter.
  const previous = commits[selectedIndex + 1];

  // Split the noisy background auto-saves out from deliberate labeled commits
  // (the timeline defaults to the clean "commits" view).
  const autosaveCount = commits.filter(isAutosave).length;
  const commitCount = commits.length - autosaveCount;
  const visibleCommits = commits.filter((c) =>
    tab === "autosaves" ? isAutosave(c) : !isAutosave(c),
  );

  const { data: selectedContent, status: contentStatus } =
    useAsyncData(async () => {
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
    }, [selected?.commitHash, previous?.commitHash, getGitShow]);

  const handleCommit = async () => {
    setIsCommitting(true);
    try {
      const response = await sendGitCommit({
        message: commitMessage.trim() || "Manual save point",
      });
      if (response.success) {
        toast({
          description: response.pushed
            ? "Saved a new version and pushed to GitHub."
            : "Saved a new version.",
        });
        setCommitMessage("");
        refetchLog();
      } else {
        toast({
          variant: "danger",
          description: response.message ?? "Nothing to commit.",
        });
      }
    } finally {
      setIsCommitting(false);
    }
  };

  const handleCreateRemote = async () => {
    const name = repoName.trim();
    if (!name) {
      return;
    }
    setIsCreatingRepo(true);
    try {
      const response = await sendGitCreateRemote({
        name,
        private: repoIsPrivate,
      });
      if (response.success) {
        toast({ description: `Created and linked ${name} on GitHub.` });
        setShowCreateRepoForm(false);
        refetchLog();
      } else {
        toast({
          variant: "danger",
          description: response.message ?? "Could not create that repo.",
        });
      }
    } finally {
      setIsCreatingRepo(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    try {
      const response = await sendGitPull();
      if (response.success) {
        const count = response.newCommits ?? 0;
        toast({
          description:
            count === 0
              ? "Already up to date with GitHub."
              : `Pulled ${count} new ${count === 1 ? "version" : "versions"} from GitHub.`,
        });
        if (count > 0) {
          refetchLog();
        }
      } else {
        toast({
          variant: "danger",
          description: response.message ?? "Could not pull from GitHub.",
        });
      }
    } finally {
      setIsPulling(false);
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
                  description:
                    response.message ?? "Could not restore that version.",
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
        <span className="text-[13px] text-muted-foreground">
          Loading history…
        </span>
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
      <div className="flex items-center justify-between gap-3 border-b py-3 pr-12 pl-4">
        <h2 className="text-[13px] font-medium">Version history</h2>
        {log.hasRemote ? (
          <div className="flex items-center gap-3">
            <Tooltip content="Fetch versions pushed from other machines into this notebook's history">
              <Button
                size="xs"
                variant="outline"
                data-testid="git-pull-button"
                disabled={isPulling}
                onClick={handlePull}
              >
                <DownloadIcon
                  strokeWidth={1.5}
                  className="mr-1.5 h-3.5 w-3.5"
                />
                {isPulling ? "Pulling…" : "Pull from GitHub"}
              </Button>
            </Tooltip>
            <a
              href={log.remoteUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
            >
              <Github className="h-3.5 w-3.5" />
              View on GitHub
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <Button
            size="xs"
            variant="outline"
            data-testid="create-github-repo-button"
            onClick={() => setShowCreateRepoForm((prev) => !prev)}
          >
            <Github className="mr-1.5 h-3.5 w-3.5" />
            Create repo on GitHub
          </Button>
        )}
      </div>
      {showCreateRepoForm && !log.hasRemote && (
        <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2.5">
          <Input
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder="repo-name"
            className="h-7 w-56 text-[12px]"
            data-testid="github-repo-name-input"
          />
          <label
            htmlFor={privateCheckboxId}
            className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
          >
            <Checkbox
              id={privateCheckboxId}
              checked={repoIsPrivate}
              onCheckedChange={(checked) => setRepoIsPrivate(checked === true)}
            />
            Private
          </label>
          <Button
            size="xs"
            variant="outline"
            disabled={isCreatingRepo || !repoName.trim()}
            onClick={handleCreateRemote}
          >
            {isCreatingRepo ? "Creating…" : "Create"}
          </Button>
        </div>
      )}
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
          className="h-7 max-w-72 flex-1 text-[12px]"
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
        <div className="flex flex-1 items-center justify-center">
          <PanelEmptyState
            title="No versions yet"
            description="Save the notebook (or use Save above) to create the first version."
            icon={<HistoryIcon />}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="flex w-[280px] shrink-0 flex-col border-r">
            <div className="flex items-center gap-0.5 border-b p-2">
              <HistoryTabButton
                active={tab === "commits"}
                count={commitCount}
                onClick={() => setTab("commits")}
              >
                Commits
              </HistoryTabButton>
              <HistoryTabButton
                active={tab === "autosaves"}
                count={autosaveCount}
                onClick={() => setTab("autosaves")}
              >
                Auto-saves
              </HistoryTabButton>
            </div>
            <Command className="min-h-0 flex-1 rounded-none bg-card">
              <CommandList className="max-h-none flex-1 overflow-y-auto p-1">
                {visibleCommits.length === 0 ? (
                  <div className="px-3 py-8 text-center text-[12px] leading-5 text-muted-foreground">
                    {tab === "commits"
                      ? "No labeled versions yet. Use “Save a labeled version” above to mark a save point you can find later."
                      : "No auto-saves yet."}
                  </div>
                ) : (
                  visibleCommits.map((commit) => (
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
                        {timeAgo(commit.date, locale)} ·{" "}
                        {commit.commitHash.slice(0, 7)}
                      </span>
                    </CommandItem>
                  ))
                )}
              </CommandList>
            </Command>
          </div>
          <div className="flex min-w-0 flex-1 flex-col bg-card">
            {!selected ? (
              <PanelEmptyState title="Select a version to preview it." />
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
                    <RotateCcwIcon
                      strokeWidth={1.5}
                      className="mr-1.5 h-3.5 w-3.5"
                    />
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
      )}
    </div>
  );
};
