# Copyright 2026 Marimo. All rights reserved.
"""Per-notebook git version history.

Skies feature: every notebook gets its own hidden git repository (keyed by a
hash of the notebook's absolute path, stored under the marimo state dir — NOT
inside the user's project) that tracks the notebook's serialized source over
time. This gives a lightweight "version history" UI without requiring the
user's project itself to be a git repo, and without polluting it with a
`.git` directory per notebook.
"""

from __future__ import annotations

import base64
import dataclasses
import hashlib
import shutil
import subprocess
from pathlib import Path

from marimo import _loggers
from marimo._utils.xdg import marimo_state_dir

LOGGER = _loggers.marimo_logger()

# `git hash-object -t tree /dev/null` — the well-known empty tree, used as
# the "before" side when diffing a commit that has no parent.
_EMPTY_TREE_SHA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"

_GIT_TIMEOUT_SECONDS = 10


@dataclasses.dataclass(frozen=True)
class GitCommitRecord:
    """A single commit in a notebook's history."""

    commit_hash: str
    date: str
    message: str


def _git_available() -> bool:
    return shutil.which("git") is not None


class NotebookGitHistory:
    """Manages the hidden per-notebook git repo used for version history.

    All git invocations shell out to the `git` CLI (no Python git library is
    a project dependency) and are synchronous — each operates on a single
    small tracked file, so this is fast enough to run inline on the (already
    synchronous, lock-guarded) notebook save path.
    """

    def __init__(self, notebook_path: str | Path) -> None:
        self.notebook_path = Path(notebook_path).resolve()
        # A stable, filesystem-safe key derived from the absolute notebook
        # path, so renaming/moving the notebook starts a new history rather
        # than silently colliding with (or losing) another notebook's repo.
        key = hashlib.sha256(str(self.notebook_path).encode()).hexdigest()
        self.repo_dir = marimo_state_dir() / "notebook_history" / key
        # The tracked file keeps the notebook's own basename so `git show`
        # output and any future export are recognizable, but it otherwise
        # has no relationship to the real file beyond being a content copy.
        self.tracked_filename = self.notebook_path.name

    @property
    def is_available(self) -> bool:
        return _git_available()

    def _repo_exists(self) -> bool:
        return (self.repo_dir / ".git").is_dir()

    def _run_git(
        self, *args: str, check: bool = True
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", *args],
            cwd=self.repo_dir,
            capture_output=True,
            text=True,
            timeout=_GIT_TIMEOUT_SECONDS,
            check=check,
        )

    def _ensure_repo(self) -> None:
        if self._repo_exists():
            return
        self.repo_dir.mkdir(parents=True, exist_ok=True)
        self._run_git("init", "-q")
        # Local-only config (not --global): never touch the user's own git
        # identity, and never let a global `commit.gpgsign=true` block an
        # automatic history commit.
        self._run_git("config", "user.name", "Skies")
        self._run_git("config", "user.email", "skies@localhost")
        self._run_git("config", "commit.gpgsign", "false")

    def commit(
        self, content: str, message: str | None = None
    ) -> GitCommitRecord | None:
        """Write `content` and commit it if it differs from HEAD.

        Returns the new commit record, or `None` if git is unavailable or
        there was nothing to commit (content unchanged since the last
        commit) — this keeps autosave from creating a commit per keystroke.
        """
        if not self.is_available:
            return None
        try:
            self._ensure_repo()
            tracked_path = self.repo_dir / self.tracked_filename
            tracked_path.write_text(content)

            status = self._run_git(
                "status", "--porcelain", "--", self.tracked_filename
            )
            if not status.stdout.strip():
                return None

            self._run_git("add", "--", self.tracked_filename)
            self._run_git("commit", "-q", "-m", message or "Autosave")
            return self._head_record()
        except (OSError, subprocess.SubprocessError) as e:
            LOGGER.warning(
                "Failed to commit notebook history for %s: %s",
                self.notebook_path,
                e,
            )
            return None

    def _head_record(self) -> GitCommitRecord:
        result = self._run_git(
            "log", "-n1", "--date=iso-strict", "--pretty=format:%H%x1f%ad%x1f%s"
        )
        return _parse_log_line(result.stdout)

    def log(self, limit: int = 200) -> list[GitCommitRecord]:
        """List commits, most recent first. Empty if unavailable/no history."""
        if not self.is_available or not self._repo_exists():
            return []
        try:
            result = self._run_git(
                "log",
                f"-n{limit}",
                "--date=iso-strict",
                "--pretty=format:%H%x1f%ad%x1f%s",
                check=False,
            )
        except subprocess.SubprocessError as e:
            LOGGER.warning(
                "Failed to read notebook history for %s: %s",
                self.notebook_path,
                e,
            )
            return []
        if result.returncode != 0 or not result.stdout.strip():
            # A brand-new repo with no commits yet exits non-zero.
            return []
        return [
            _parse_log_line(line)
            for line in result.stdout.splitlines()
            if line
        ]

    def show(self, commit_hash: str) -> str | None:
        """Get the notebook source as it was at `commit_hash`."""
        if not self.is_available or not self._repo_exists():
            return None
        try:
            result = self._run_git(
                "show", f"{commit_hash}:{self.tracked_filename}"
            )
        except subprocess.SubprocessError as e:
            LOGGER.warning(
                "Failed to read commit %s for %s: %s",
                commit_hash,
                self.notebook_path,
                e,
            )
            return None
        return result.stdout

    def diff(self, commit_hash: str) -> str | None:
        """Unified diff from `commit_hash`'s parent to `commit_hash`.

        Diffs against the empty tree when `commit_hash` is the first commit
        (has no parent).
        """
        if not self.is_available or not self._repo_exists():
            return None
        parent_check = self._run_git(
            "rev-parse", "--verify", f"{commit_hash}^", check=False
        )
        before = (
            parent_check.stdout.strip()
            if parent_check.returncode == 0
            else _EMPTY_TREE_SHA
        )
        try:
            result = self._run_git(
                "diff",
                "--no-color",
                before,
                commit_hash,
                "--",
                self.tracked_filename,
            )
        except subprocess.SubprocessError as e:
            LOGGER.warning(
                "Failed to diff commit %s for %s: %s",
                commit_hash,
                self.notebook_path,
                e,
            )
            return None
        return result.stdout

    def has_remote(self, name: str = "origin") -> bool:
        return self.remote_url(name) is not None

    def remote_url(self, name: str = "origin") -> str | None:
        if not self.is_available or not self._repo_exists():
            return None
        try:
            result = self._run_git("remote", "get-url", name, check=False)
        except subprocess.SubprocessError:
            return None
        if result.returncode != 0:
            return None
        return result.stdout.strip() or None

    def add_remote(self, url: str, name: str = "origin") -> None:
        """Add (or repoint) a remote. Does not touch any credentials — the
        URL itself must not embed a token; `push` authenticates per-call."""
        if not self.is_available:
            return
        try:
            self._ensure_repo()
            if self.has_remote(name):
                self._run_git("remote", "set-url", name, url)
            else:
                self._run_git("remote", "add", name, url)
        except (OSError, subprocess.SubprocessError) as e:
            LOGGER.warning(
                "Failed to set remote for %s: %s", self.notebook_path, e
            )

    def _current_branch(self) -> str:
        result = self._run_git("branch", "--show-current")
        return result.stdout.strip()

    def push(self, token: str, *, name: str = "origin") -> bool:
        """Push the current branch to `name`, authenticating with `token`
        for this invocation only (via a per-call HTTP header) so it is never
        written to `.git/config` or the remote URL on disk.

        Returns whether the push succeeded (git is available, there's a
        commit to push, and the remote accepted it).
        """
        if not self.is_available or not self._repo_exists():
            return False
        try:
            branch = self._current_branch()
            if not branch:
                # No commits yet (e.g. remote linked before any save) —
                # nothing to push.
                return False
            auth_header = _basic_auth_header(token)
            result = self._run_git(
                "-c",
                f"http.extraheader={auth_header}",
                "push",
                "-u",
                name,
                f"HEAD:{branch}",
                check=False,
            )
            if result.returncode != 0:
                LOGGER.warning(
                    "Failed to push notebook history for %s: %s",
                    self.notebook_path,
                    result.stderr,
                )
            return result.returncode == 0
        except (OSError, subprocess.SubprocessError) as e:
            LOGGER.warning(
                "Failed to push notebook history for %s: %s",
                self.notebook_path,
                e,
            )
            return False


def _basic_auth_header(token: str) -> str:
    # GitHub (and most providers) accept a bearer-style PAT as the password
    # in HTTP Basic auth over HTTPS; git's `http.extraHeader` lets us pass
    # that per-invocation instead of persisting it in a credential store or
    # embedding it in the remote URL.
    encoded = base64.b64encode(f"x-access-token:{token}".encode()).decode()
    return f"Authorization: Basic {encoded}"


def _parse_log_line(line: str) -> GitCommitRecord:
    commit_hash, date, message = line.strip("\n").split("\x1f", 2)
    return GitCommitRecord(commit_hash=commit_hash, date=date, message=message)
