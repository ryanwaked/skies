# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

import shutil
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest

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
        mock_app_state_cls.return_value.require_current_session.return_value = (
            fake_session
        )
        history, error = _history_for_current_session(fake_request)

    assert history is None
    assert error is not None
