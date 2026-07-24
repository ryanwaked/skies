# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

import os
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from typing import TYPE_CHECKING

from marimo._config.manager import UserConfigManager
from marimo._messaging.notification import (
    CellNotification,
    KernelReadyNotification,
)
from marimo._server.workspace import DirectoryWorkspace
from marimo._session import Session
from marimo._session.model import ConnectionState
from marimo._types.ids import SessionId
from marimo._utils.parse_dataclass import parse_raw
from tests._server.api.endpoints.ws_helpers import (
    assert_kernel_ready_response,
    create_response,
    headers,
)
from tests._server.mocks import get_session_manager

if TYPE_CHECKING:
    from starlette.testclient import TestClient


def get_session(client: TestClient, session_id: SessionId) -> Session | None:
    return get_session_manager(client).get_session(session_id)


def _create_ws_url(session_id: str) -> str:
    return f"/ws?session_id={session_id}&access_token=fake-token"


def test_refresh_session(client: TestClient) -> None:
    with client.websocket_connect(_create_ws_url("123")) as websocket:
        data = websocket.receive_json()
        print(data)
        assert_kernel_ready_response(data, create_response({}))

    # Check the session still exists after closing the websocket
    session = get_session(client, SessionId("123"))
    assert session
    session_view = session.session_view

    # Mimic cell execution time save
    cell_notification = CellNotification("Hbol")
    session_view.save_execution_time(cell_notification, "start")
    time.sleep(0.123)
    session_view.save_execution_time(cell_notification, "end")
    last_exec_time = session_view.last_execution_time["Hbol"]

    # New session with new ID (simulates refresh)
    # We should resume the current session
    with client.websocket_connect(_create_ws_url("456")) as websocket:
        # First message is the kernel reconnected
        data = websocket.receive_json()
        assert data == {"op": "reconnected", "data": {"op": "reconnected"}}
        # Resume the session
        data = websocket.receive_json()
        assert_kernel_ready_response(
            data,
            create_response(
                {
                    "resumed": True,
                    "last_execution_time": {"Hbol": last_exec_time},
                }
            ),
        )
        # Send a value to the kernel
        response = client.post(
            "/api/kernel/set_ui_element_value",
            headers=headers("456"),
            json={
                "objectIds": ["ui-element-1", "ui-element-2"],
                "values": ["value1", "value2"],
            },
        )
        assert response.status_code == 200, response.text

    # Check the session switch IDs
    assert not get_session(client, "123")
    assert get_session(client, "456")

    # New session again
    # We should not resume the current session with the new values
    with client.websocket_connect(_create_ws_url("789")) as websocket:
        # First message is the kernel reconnected
        data = websocket.receive_json()
        assert data == {"op": "reconnected", "data": {"op": "reconnected"}}
        # Resume the session
        data = websocket.receive_json()
        assert_kernel_ready_response(
            data,
            create_response(
                {
                    "ui_values": {
                        "ui-element-1": "value1",
                        "ui-element-2": "value2",
                    },
                    "resumed": True,
                    "last_execution_time": {"Hbol": last_exec_time},
                }
            ),
        )
        assert response.status_code == 200, response.text

    # Check the session switch IDs
    assert not get_session(client, "456")
    assert get_session(client, "789")


def test_save_session(client: TestClient) -> None:
    filename = (
        get_session_manager(client)
        .workspace.get_single_app_file_manager()
        .filename
    )
    with client.websocket_connect(_create_ws_url("123")) as websocket:
        data = websocket.receive_json()
        assert_kernel_ready_response(data, create_response({}))
        # Send save request
        client.post(
            "/api/kernel/save",
            headers=headers("123"),
            json={
                "cellIds": ["2", "1"],
                "filename": filename,
                "codes": [
                    "slider = mo.ui.slider(0, 100)",
                    "import marimo as mo",
                ],
                "names": ["cell_0", "cell_1"],
                "configs": [
                    {
                        "hideCode": True,
                        "disabled": True,
                    },
                    {
                        "hideCode": False,
                        "disabled": False,
                    },
                ],
            },
        )

    # Check the session still exists after closing the websocket
    assert get_session(client, "123")

    # New session with new ID (simulates refresh)
    # We should resume the current session
    with client.websocket_connect(_create_ws_url("456")) as websocket:
        # First message is the kernel reconnected
        data = websocket.receive_json()
        assert data == {"op": "reconnected", "data": {"op": "reconnected"}}
        # Resume the session
        data = websocket.receive_json()
        assert_kernel_ready_response(
            data,
            create_response(
                {
                    # The cell IDs that were saved should be the ones that are
                    # resumed
                    "cell_ids": ["2", "1"],
                    "names": ["cell_0", "cell_1"],
                    "codes": [
                        "slider = mo.ui.slider(0, 100)",
                        "import marimo as mo",
                    ],
                    "configs": [
                        {
                            "hideCode": True,
                            "disabled": True,
                        },
                        {
                            "hideCode": False,
                            "disabled": False,
                        },
                    ],
                    "resumed": True,
                }
            ),
        )

    # Check the session switch IDs
    assert not get_session(client, "123")
    assert get_session(client, "456")

    # Shutdown the kernel


def test_save_config(client: TestClient) -> None:
    with client.websocket_connect(_create_ws_url("123")) as websocket:
        data = websocket.receive_json()
        assert_kernel_ready_response(data, create_response({}))
        # Send save request
        client.post(
            "/api/kernel/save_app_config",
            headers=headers("123"),
            json={
                "config": {"width": "full"},
            },
        )

    # Check the session still exists after closing the websocket
    session = get_session(client, "123")
    assert session
    assert session.app_file_manager.app.config.width == "full"

    # Loading index page should have the new config
    response = client.get("/")
    assert response.status_code == 200
    assert '"width": "full"' in response.text

    # Shutdown the kernel


def test_restart_session(client: TestClient) -> None:
    with client.websocket_connect(_create_ws_url("123")) as websocket:
        data = websocket.receive_json()
        assert_kernel_ready_response(data, create_response({}))

    # Restart the session
    response = client.post(
        "/api/kernel/restart_session",
        headers=headers("123"),
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"success": True}

    # Check the session still exists after closing the websocket
    assert not get_session(client, "123")

    # New session with new ID (simulates refresh)
    # We start a new session
    with client.websocket_connect(_create_ws_url("456")) as websocket:
        # First message is the kernel reconnected
        data = websocket.receive_json()
        assert_kernel_ready_response(
            data,
            create_response({}),
        )

    # Shutdown the kernel


def test_resume_session_after_file_change(client: TestClient) -> None:
    session_manager = get_session_manager(client)
    # Don't set session_manager.watch = True here; it would start a
    # file-watcher thread whose async callbacks can race with the
    # synchronous _handle_file_change_locked call below, reading the
    # file while it is being written and producing a spurious
    # "not a marimo notebook" error.  The test invokes the handler
    # directly, so no watcher is needed.

    with client.websocket_connect(_create_ws_url("123")) as websocket:
        data = websocket.receive_json()
        assert_kernel_ready_response(data, create_response({}))

        session = get_session(client, SessionId("123"))
        assert session

        # Write to the notebook file to add a new cell
        # we write it as the second to last cell
        filename = session_manager.workspace.get_unique_file_key()
        assert filename
        with open(filename) as f:
            content = f.read()
        last_cell_pos = content.rindex("@app.cell")
        new_content = (
            content[:last_cell_pos]
            + "\n@app.cell\ndef _(): x=10; x\n"
            + content[last_cell_pos:]
        )
        with open(filename, "w") as f:
            f.write(new_content)

        # Directly trigger the file change handler (synchronous) instead
        # of relying on the async file watcher, which is inherently racy.
        result = session_manager._file_change_coordinator._handle_file_change_locked(
            os.path.abspath(filename), session
        )
        assert result.handled

        data = websocket.receive_json()
        assert data["op"] == "notebook-document-transaction"
        tx = data["data"]["transaction"]
        # Transaction should contain the new cell and reorder.
        op_types = [op["type"] for op in tx["changes"]]
        assert "create-cell" in op_types
        assert "reorder-cells" in op_types
        assert tx["source"] == "file-watch"

    # Resume session with new ID (simulates refresh)
    with client.websocket_connect(_create_ws_url("456")) as websocket:
        # First message is the kernel reconnected
        data = websocket.receive_json()
        assert data == {"op": "reconnected", "data": {"op": "reconnected"}}

        # Check for KernelReady message
        data = websocket.receive_json()
        assert parse_raw(data["data"], KernelReadyNotification)

        # Banner notification (session replay)
        data = websocket.receive_json()
        assert data["op"] == "banner"


@contextmanager
def without_autorun_on_save(config: UserConfigManager):
    prev_config = config.get_config()
    try:
        config.save_config({"runtime": {"watcher_on_save": "lazy"}})
        yield
    finally:
        config.save_config(prev_config)


_SWITCH_NOTEBOOK = """
import marimo

__generated_with = "0.0.1"
app = marimo.App(width="full")


@app.cell
def __():
    import marimo as mo
    return mo,


if __name__ == "__main__":
    app.run()
"""


def _create_file_ws_url(session_id: str, file_key: str) -> str:
    return (
        f"/ws?session_id={session_id}&file={file_key}&access_token=fake-token"
    )


def test_sessions_keep_warm_when_switching_notebooks(
    client: TestClient,
) -> None:
    """Switching between notebooks in a project must not tear down kernels.

    Regression test for multi-notebook projects (`marimo edit dir/`):
    navigating away from a notebook disconnects its websocket, but its
    session must stay orphaned (kernel warm) and resumable — both via its
    session id and via its workspace-relative file key. Relative keys must
    resolve against the workspace directory, not the process CWD (which
    differs when the server is started as `marimo edit path/to/dir`).
    """
    session_manager = get_session_manager(client)

    with tempfile.TemporaryDirectory() as temp_dir:
        for name in ("notebook_a.py", "notebook_b.py"):
            (Path(temp_dir) / name).write_text(_SWITCH_NOTEBOOK)

        workspace = DirectoryWorkspace(temp_dir, include_markdown=False)
        original_workspace = session_manager.workspace
        session_manager.workspace = workspace

        try:
            # Open notebook A.
            with client.websocket_connect(
                _create_file_ws_url("session-a", "notebook_a.py")
            ) as websocket:
                data = websocket.receive_json()
                assert data["op"] == "kernel-ready"

            # Switching away (websocket closed) orphans the session but
            # does not close it — the kernel stays warm.
            session_a = get_session(client, SessionId("session-a"))
            assert session_a is not None
            assert session_a.connection_state() == ConnectionState.ORPHANED

            # Open notebook B in the same tab: a separate session is created.
            with client.websocket_connect(
                _create_file_ws_url("session-b", "notebook_b.py")
            ) as websocket:
                data = websocket.receive_json()
                assert data["op"] == "kernel-ready"

            assert get_session(client, SessionId("session-b")) is not None
            # Notebook A's kernel is still warm.
            assert session_a.connection_state() == ConnectionState.ORPHANED

            # Both notebooks show up as running, addressed by their
            # workspace-relative file keys.
            response = client.post(
                "/api/home/running_notebooks",
                headers=headers("session-b"),
            )
            assert response.status_code == 200
            files = {f["path"]: f for f in response.json()["files"]}
            assert set(files) == {"notebook_a.py", "notebook_b.py"}
            assert files["notebook_a.py"]["sessionId"] == "session-a"
            assert files["notebook_b.py"]["sessionId"] == "session-b"
            assert files["notebook_a.py"]["initializationId"]
            assert files["notebook_b.py"]["initializationId"]

            # Switch back to notebook A with a fresh session id (the client
            # generates a new id when it doesn't know the running one): the
            # orphaned session is resumed via its relative file key.
            with client.websocket_connect(
                _create_file_ws_url("session-a2", "notebook_a.py")
            ) as websocket:
                data = websocket.receive_json()
                assert data == {
                    "op": "reconnected",
                    "data": {"op": "reconnected"},
                }
                data = websocket.receive_json()
                kernel_ready = parse_raw(data["data"], KernelReadyNotification)
                assert kernel_ready.resumed

            # The resumed session took over the new id; notebook B's
            # session is untouched.
            assert get_session(client, SessionId("session-a")) is None
            assert get_session(client, SessionId("session-a2")) is not None
            assert get_session(client, SessionId("session-b")) is not None
        finally:
            session_manager.workspace = original_workspace
            session_manager.close_all_sessions()
