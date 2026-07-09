# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, patch

from tests._server.mocks import token_header

if TYPE_CHECKING:
    from starlette.testclient import TestClient

SESSION_ID = "remote-compute-session"


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


def _save_targets(client: TestClient, *targets: dict[str, object]) -> None:
    response = client.post(
        "/api/kernel/save_user_config",
        headers=token_header("fake-token"),
        json={"config": {"remote_compute": {"targets": list(targets)}}},
    )
    assert response.status_code == 200, response.text


def test_verify_target_empty_destination(client: TestClient) -> None:
    response = client.post(
        "/api/remote_compute/verify_target",
        headers=token_header("fake-token"),
        json={"sshDestination": "  "},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is False
    assert "Enter an SSH destination" in body["message"]


def test_verify_target_success(client: TestClient) -> None:
    fake_proc = AsyncMock()
    fake_proc.communicate = AsyncMock(return_value=(b"", b""))
    fake_proc.returncode = 0
    with patch(
        "marimo._server.api.endpoints.remote_compute.asyncio.create_subprocess_exec",
        new=AsyncMock(return_value=fake_proc),
    ):
        response = client.post(
            "/api/remote_compute/verify_target",
            headers=token_header("fake-token"),
            json={"sshDestination": "user@example.com"},
        )
    assert response.status_code == 200, response.text
    assert response.json()["success"] is True


def test_verify_target_ssh_failure(client: TestClient) -> None:
    fake_proc = AsyncMock()
    fake_proc.communicate = AsyncMock(
        return_value=(b"", b"Connection refused")
    )
    fake_proc.returncode = 255
    with patch(
        "marimo._server.api.endpoints.remote_compute.asyncio.create_subprocess_exec",
        new=AsyncMock(return_value=fake_proc),
    ):
        response = client.post(
            "/api/remote_compute/verify_target",
            headers=token_header("fake-token"),
            json={"sshDestination": "user@example.com"},
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is False
    assert "Connection refused" in body["message"]


def test_verify_target_ssh_not_installed(client: TestClient) -> None:
    with patch(
        "marimo._server.api.endpoints.remote_compute.asyncio.create_subprocess_exec",
        new=AsyncMock(side_effect=FileNotFoundError()),
    ):
        response = client.post(
            "/api/remote_compute/verify_target",
            headers=token_header("fake-token"),
            json={"sshDestination": "user@example.com"},
        )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is False
    assert "ssh is not installed" in body["message"]


def test_set_target_unknown_name_fails(
    client: TestClient, temp_marimo_file: str
) -> None:
    with client.websocket_connect(_ws_url(temp_marimo_file)) as websocket:
        assert websocket.receive_json()
        response = client.post(
            "/api/remote_compute/set_target",
            headers=_headers(),
            json={"targetName": "does-not-exist"},
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["success"] is False
        assert "does-not-exist" in body["message"]
        client.post("/api/kernel/shutdown", headers=_headers())


def test_set_target_success_records_override(
    client: TestClient, temp_marimo_file: str
) -> None:
    _save_targets(
        client,
        {
            "name": "gpu-box",
            "ssh_destination": "user@example.com",
            "remote_python": "python3",
        },
    )
    with client.websocket_connect(_ws_url(temp_marimo_file)) as websocket:
        assert websocket.receive_json()

        response = client.post(
            "/api/remote_compute/set_target",
            headers=_headers(),
            json={"targetName": "gpu-box"},
        )
        assert response.status_code == 200, response.text
        assert response.json()["success"] is True

        session_manager = client.app.state.session_manager  # type: ignore[attr-defined]
        file_key = session_manager.workspace.get_unique_file_key()
        target = session_manager.get_remote_compute_target(file_key)
        assert target is not None
        assert target.name == "gpu-box"
        assert target.ssh_destination == "user@example.com"


def test_set_target_clear_removes_override(
    client: TestClient, temp_marimo_file: str
) -> None:
    """Setting a target closes the session (so the change takes effect on
    reconnect), so a second `set_target` call in the same test needs the
    close to be a no-op -- the close/reconnect behavior itself is already
    covered by test_execution.py's restart_session tests."""
    _save_targets(
        client,
        {
            "name": "gpu-box",
            "ssh_destination": "user@example.com",
            "remote_python": "python3",
        },
    )
    with client.websocket_connect(_ws_url(temp_marimo_file)) as websocket:
        assert websocket.receive_json()
        session_manager = client.app.state.session_manager  # type: ignore[attr-defined]
        # Isolate target-clearing from the close-session side effect (which
        # is already covered by test_execution.py's restart_session tests)
        # so both calls below can run against the same live session.
        session_manager.close_session = lambda *_a, **_k: False

        file_key = session_manager.workspace.get_unique_file_key()
        client.post(
            "/api/remote_compute/set_target",
            headers=_headers(),
            json={"targetName": "gpu-box"},
        )
        assert session_manager.get_remote_compute_target(file_key) is not None

        response = client.post(
            "/api/remote_compute/set_target",
            headers=_headers(),
            json={"targetName": None},
        )
        assert response.status_code == 200, response.text
        assert response.json()["success"] is True
        assert session_manager.get_remote_compute_target(file_key) is None
