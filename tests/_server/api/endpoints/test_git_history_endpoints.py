# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from marimo._utils.git_providers import GitHubRepo, GitProviderError
from tests._server.mocks import token_header

if TYPE_CHECKING:
    from starlette.testclient import TestClient

pytestmark = pytest.mark.skipif(
    shutil.which("git") is None, reason="git is not installed"
)

SESSION_ID = "git-history-session"


def _ws_url(temp_marimo_file: str) -> str:
    return (
        f"/ws?session_id={SESSION_ID}&access_token=fake-token"
        f"&file={temp_marimo_file}"
    )


def _headers() -> dict[str, str]:
    return {
        "Marimo-Session-Id": SESSION_ID,
        **token_header("fake-token"),
    }


def test_log_show_and_commit(
    client: TestClient, temp_marimo_file: str
) -> None:
    with client.websocket_connect(_ws_url(temp_marimo_file)) as websocket:
        assert websocket.receive_json()

        # No manual commits yet, but the notebook is saved on connect via
        # the app file manager, so a log call should at least succeed.
        log_response = client.post(
            "/api/git_history/log", headers=_headers(), json={}
        )
        assert log_response.status_code == 200, log_response.text
        log_body = log_response.json()
        assert log_body["available"] is True

        commit_response = client.post(
            "/api/git_history/commit",
            headers=_headers(),
            json={"message": "My checkpoint"},
        )
        assert commit_response.status_code == 200, commit_response.text
        commit_body = commit_response.json()
        assert commit_body["success"] is True
        assert commit_body["commit"]["message"] == "My checkpoint"
        commit_hash = commit_body["commit"]["commitHash"]

        # A second identical commit is a no-op (nothing changed).
        noop_response = client.post(
            "/api/git_history/commit",
            headers=_headers(),
            json={"message": "duplicate"},
        )
        assert noop_response.status_code == 200, noop_response.text
        assert noop_response.json()["success"] is False

        log_response = client.post(
            "/api/git_history/log", headers=_headers(), json={}
        )
        commits = log_response.json()["commits"]
        assert any(c["commitHash"] == commit_hash for c in commits)

        show_response = client.post(
            "/api/git_history/show",
            headers=_headers(),
            json={"commitHash": commit_hash},
        )
        assert show_response.status_code == 200, show_response.text
        assert show_response.json()["content"] is not None

        client.post("/api/kernel/shutdown", headers=_headers())


def test_restore(client: TestClient, temp_marimo_file: str) -> None:
    with client.websocket_connect(_ws_url(temp_marimo_file)) as websocket:
        assert websocket.receive_json()

        first_commit = client.post(
            "/api/git_history/commit",
            headers=_headers(),
            json={"message": "checkpoint one"},
        ).json()

        # If the initial save produced no diff, seed a real commit by
        # writing new content through the same commit endpoint isn't
        # possible directly (it reads the on-disk file), so just assert
        # the restore endpoint behaves sanely against whatever the latest
        # real commit is.
        log = client.post(
            "/api/git_history/log", headers=_headers(), json={}
        ).json()
        assert log["commits"], "expected at least one commit to restore"
        target_hash = (
            first_commit["commit"]["commitHash"]
            if first_commit.get("success")
            else log["commits"][0]["commitHash"]
        )

        restore_response = client.post(
            "/api/git_history/restore",
            headers=_headers(),
            json={"commitHash": target_hash},
        )
        assert restore_response.status_code == 200, restore_response.text
        assert restore_response.json()["success"] is True

        client.post("/api/kernel/shutdown", headers=_headers())


def test_restore_unknown_commit_fails_gracefully(
    client: TestClient, temp_marimo_file: str
) -> None:
    with client.websocket_connect(_ws_url(temp_marimo_file)) as websocket:
        assert websocket.receive_json()

        response = client.post(
            "/api/git_history/restore",
            headers=_headers(),
            json={"commitHash": "0" * 40},
        )
        assert response.status_code == 200, response.text
        assert response.json()["success"] is False

        client.post("/api/kernel/shutdown", headers=_headers())


def _save_github_token(client: TestClient, token: str) -> None:
    response = client.post(
        "/api/kernel/save_user_config",
        headers=token_header("fake-token"),
        json={"config": {"version_control": {"github": {"token": token}}}},
    )
    assert response.status_code == 200, response.text


def test_verify_provider_no_token(client: TestClient) -> None:
    response = client.post(
        "/api/git_history/verify_provider", headers=token_header("fake-token")
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is False
    assert "No GitHub account connected" in body["message"]


def test_verify_provider_success(client: TestClient) -> None:
    _save_github_token(client, "fake-pat")
    with patch(
        "marimo._server.api.endpoints.git_history.GitHubClient.whoami",
        new=AsyncMock(return_value="octocat"),
    ):
        response = client.post(
            "/api/git_history/verify_provider",
            headers=token_header("fake-token"),
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    assert body["username"] == "octocat"


def test_verify_provider_invalid_token(client: TestClient) -> None:
    _save_github_token(client, "bad-pat")
    with patch(
        "marimo._server.api.endpoints.git_history.GitHubClient.whoami",
        new=AsyncMock(
            side_effect=GitProviderError(
                "GitHub API error (401): Bad credentials"
            )
        ),
    ):
        response = client.post(
            "/api/git_history/verify_provider",
            headers=token_header("fake-token"),
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is False
    assert "Bad credentials" in body["message"]


def test_create_remote_without_token_fails(
    client: TestClient, temp_marimo_file: str
) -> None:
    with client.websocket_connect(_ws_url(temp_marimo_file)) as websocket:
        assert websocket.receive_json()
        response = client.post(
            "/api/git_history/create_remote",
            headers=_headers(),
            json={"name": "my-notebook", "private": True},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["success"] is False
        assert "Connect a GitHub account" in body["message"]
        client.post("/api/kernel/shutdown", headers=_headers())


def test_create_remote_and_push(
    client: TestClient, temp_marimo_file: str, tmp_path: Path
) -> None:
    """End-to-end against a local bare repo standing in for GitHub: the
    'create_repo' API call is mocked, but add_remote/push are real git
    operations, so this verifies the whole plumbing actually pushes."""
    _save_github_token(client, "fake-pat")
    remote_dir = str(tmp_path / "remote.git")
    subprocess.run(["git", "init", "--bare", "-q", remote_dir], check=True)

    fake_repo = GitHubRepo(
        full_name="octocat/my-notebook",
        html_url="https://github.com/octocat/my-notebook",
        clone_url=remote_dir,
    )
    with client.websocket_connect(_ws_url(temp_marimo_file)) as websocket:
        assert websocket.receive_json()

        with patch(
            "marimo._server.api.endpoints.git_history.GitHubClient.create_repo",
            new=AsyncMock(return_value=fake_repo),
        ):
            response = client.post(
                "/api/git_history/create_remote",
                headers=_headers(),
                json={"name": "my-notebook", "private": True},
            )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["success"] is True, body
        assert body["htmlUrl"] == fake_repo.html_url

        # The remote's git log should now contain the pushed commit.
        remote_log = subprocess.run(
            ["git", "log", "--oneline"],
            cwd=remote_dir,
            capture_output=True,
            text=True,
        )
        assert remote_log.stdout.strip(), "expected a pushed commit"

        # log() now reports the linked remote.
        log_response = client.post(
            "/api/git_history/log", headers=_headers(), json={}
        )
        log_body = log_response.json()
        assert log_body["hasRemote"] is True
        assert log_body["remoteUrl"] == remote_dir

        # A subsequent manual commit should also push automatically.
        existing = Path(temp_marimo_file).read_text()
        Path(temp_marimo_file).write_text(existing + "\n# edited\n")

        commit_response = client.post(
            "/api/git_history/commit",
            headers=_headers(),
            json={"message": "second checkpoint"},
        )
        commit_body = commit_response.json()
        assert commit_body["success"] is True, commit_body
        assert commit_body["pushed"] is True

        client.post("/api/kernel/shutdown", headers=_headers())


def test_pull_without_remote_fails(
    client: TestClient, temp_marimo_file: str
) -> None:
    with client.websocket_connect(_ws_url(temp_marimo_file)) as websocket:
        assert websocket.receive_json()
        response = client.post(
            "/api/git_history/pull", headers=_headers(), json={}
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["success"] is False
        assert "No GitHub repo is linked" in body["message"]
        client.post("/api/kernel/shutdown", headers=_headers())


def test_pull_from_linked_remote(
    client: TestClient, temp_marimo_file: str, tmp_path: Path
) -> None:
    """End-to-end against a local bare repo standing in for GitHub: link the
    remote via create_remote (create_repo mocked), then verify /pull reports
    up-to-date, and picks up a commit pushed to the remote out-of-band."""
    _save_github_token(client, "fake-pat")
    remote_dir = str(tmp_path / "remote.git")
    subprocess.run(["git", "init", "--bare", "-q", remote_dir], check=True)

    fake_repo = GitHubRepo(
        full_name="octocat/my-notebook",
        html_url="https://github.com/octocat/my-notebook",
        clone_url=remote_dir,
    )
    with client.websocket_connect(_ws_url(temp_marimo_file)) as websocket:
        assert websocket.receive_json()

        with patch(
            "marimo._server.api.endpoints.git_history.GitHubClient.create_repo",
            new=AsyncMock(return_value=fake_repo),
        ):
            response = client.post(
                "/api/git_history/create_remote",
                headers=_headers(),
                json={"name": "my-notebook", "private": True},
            )
        assert response.json()["success"] is True

        # Nothing new on the remote yet.
        pull_response = client.post(
            "/api/git_history/pull", headers=_headers(), json={}
        )
        assert pull_response.status_code == 200, pull_response.text
        pull_body = pull_response.json()
        assert pull_body["success"] is True, pull_body
        assert pull_body["newCommits"] == 0

        # Simulate another machine pushing a new version to the remote.
        clone_dir = tmp_path / "other-machine"
        subprocess.run(
            ["git", "clone", "-q", remote_dir, str(clone_dir)], check=True
        )
        tracked = next(p for p in clone_dir.iterdir() if p.name != ".git")
        tracked.write_text(tracked.read_text() + "\n# from elsewhere\n")
        subprocess.run(
            ["git", "commit", "-aqm", "Edit from another machine"],
            cwd=clone_dir,
            check=True,
            env={
                **os.environ,
                "GIT_AUTHOR_NAME": "Other",
                "GIT_AUTHOR_EMAIL": "other@localhost",
                "GIT_COMMITTER_NAME": "Other",
                "GIT_COMMITTER_EMAIL": "other@localhost",
            },
        )
        subprocess.run(["git", "push", "-q"], cwd=clone_dir, check=True)

        pull_response = client.post(
            "/api/git_history/pull", headers=_headers(), json={}
        )
        pull_body = pull_response.json()
        assert pull_body["success"] is True, pull_body
        assert pull_body["newCommits"] == 1

        # The pulled version now shows up in the notebook's history.
        log_body = client.post(
            "/api/git_history/log", headers=_headers(), json={}
        ).json()
        messages = [c["message"] for c in log_body["commits"]]
        assert "Edit from another machine" in messages

        client.post("/api/kernel/shutdown", headers=_headers())


def test_log_unavailable_without_a_file_path() -> None:
    """A notebook with no on-disk path yet has no history to show.

    In practice `AppFileManager.path` is populated even for a brand-new,
    never-explicitly-saved notebook (the workspace assigns it a temp file
    immediately), so this guard is exercised directly rather than through
    the HTTP layer.
    """
    from marimo._server.api.endpoints.git_history import (
        _history_for_current_session,
    )

    fake_request = MagicMock()
    fake_session = MagicMock()
    fake_session.app_file_manager.path = None

    with patch(
        "marimo._server.api.endpoints.git_history.AppState"
    ) as mock_app_state_cls:
        mock_app_state_cls.return_value.require_current_session.return_value = fake_session
        history, error = _history_for_current_session(fake_request)

    assert history is None
    assert error is not None
