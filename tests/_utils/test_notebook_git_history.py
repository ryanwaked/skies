# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

import shutil
from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest

from marimo._utils.notebook_git_history import NotebookGitHistory

if TYPE_CHECKING:
    from pathlib import Path

pytestmark = pytest.mark.skipif(
    shutil.which("git") is None, reason="git is not installed"
)


@pytest.fixture
def notebook_path(tmp_path: Path) -> Path:
    return tmp_path / "my_notebook.py"


def test_is_available(notebook_path: Path) -> None:
    history = NotebookGitHistory(notebook_path)
    assert history.is_available is True


def test_unavailable_when_git_missing(notebook_path: Path) -> None:
    with patch("shutil.which", return_value=None):
        history = NotebookGitHistory(notebook_path)
        assert history.is_available is False
        assert history.commit("import marimo\n") is None
        assert history.log() == []
        assert history.show("abc123") is None
        assert history.diff("abc123") is None


def test_log_empty_before_any_commit(notebook_path: Path) -> None:
    history = NotebookGitHistory(notebook_path)
    assert history.log() == []


def test_commit_and_log(notebook_path: Path) -> None:
    history = NotebookGitHistory(notebook_path)

    record = history.commit("import marimo\napp = marimo.App()\n", "first")
    assert record is not None
    assert record.message == "first"
    assert len(record.commit_hash) == 40

    log = history.log()
    assert len(log) == 1
    assert log[0].commit_hash == record.commit_hash
    assert log[0].message == "first"


def test_commit_is_a_noop_when_content_unchanged(notebook_path: Path) -> None:
    history = NotebookGitHistory(notebook_path)
    content = "import marimo\napp = marimo.App()\n"

    first = history.commit(content, "first")
    assert first is not None

    second = history.commit(content, "duplicate")
    assert second is None
    assert len(history.log()) == 1


def test_commit_default_message_is_autosave(notebook_path: Path) -> None:
    history = NotebookGitHistory(notebook_path)
    record = history.commit("import marimo\n")
    assert record is not None
    assert record.message == "Autosave"


def test_log_is_most_recent_first(notebook_path: Path) -> None:
    history = NotebookGitHistory(notebook_path)
    first = history.commit("v1\n", "first")
    second = history.commit("v2\n", "second")
    assert first is not None
    assert second is not None

    log = history.log()
    assert [c.commit_hash for c in log] == [
        second.commit_hash,
        first.commit_hash,
    ]


def test_log_respects_limit(notebook_path: Path) -> None:
    history = NotebookGitHistory(notebook_path)
    for i in range(5):
        history.commit(f"v{i}\n", f"commit {i}")

    assert len(history.log(limit=2)) == 2
    assert len(history.log(limit=100)) == 5


def test_show_returns_content_at_commit(notebook_path: Path) -> None:
    history = NotebookGitHistory(notebook_path)
    first = history.commit("v1\n", "first")
    second = history.commit("v2\n", "second")
    assert first is not None
    assert second is not None

    assert history.show(first.commit_hash) == "v1\n"
    assert history.show(second.commit_hash) == "v2\n"


def test_show_unknown_commit_returns_none(notebook_path: Path) -> None:
    history = NotebookGitHistory(notebook_path)
    history.commit("v1\n", "first")
    assert history.show("0" * 40) is None


def test_diff_against_parent(notebook_path: Path) -> None:
    history = NotebookGitHistory(notebook_path)
    history.commit("line1\n", "first")
    second = history.commit("line1\nline2\n", "second")
    assert second is not None

    diff = history.diff(second.commit_hash)
    assert diff is not None
    assert "+line2" in diff


def test_diff_of_first_commit_uses_empty_tree(notebook_path: Path) -> None:
    history = NotebookGitHistory(notebook_path)
    first = history.commit("line1\n", "first")
    assert first is not None

    diff = history.diff(first.commit_hash)
    assert diff is not None
    assert "new file mode" in diff
    assert "+line1" in diff


def test_each_notebook_path_gets_its_own_repo(tmp_path: Path) -> None:
    a = NotebookGitHistory(tmp_path / "a.py")
    b = NotebookGitHistory(tmp_path / "b.py")
    assert a.repo_dir != b.repo_dir

    a.commit("a content\n", "a")
    assert len(a.log()) == 1
    assert len(b.log()) == 0


def test_repo_dir_is_outside_the_notebook_directory(
    tmp_path: Path, notebook_path: Path
) -> None:
    history = NotebookGitHistory(notebook_path)
    history.commit("content\n", "first")
    assert not history.repo_dir.is_relative_to(tmp_path)


def test_commit_survives_missing_git_binary_gracefully(
    notebook_path: Path,
) -> None:
    history = NotebookGitHistory(notebook_path)
    history.commit("content\n", "first")

    with patch("shutil.which", return_value=None):
        # is_available flips False; nothing should raise.
        assert history.commit("more content\n", "second") is None
        assert history.log() == []
