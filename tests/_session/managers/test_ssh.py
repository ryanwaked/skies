# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

import subprocess
from typing import TYPE_CHECKING
from unittest.mock import MagicMock

import pytest

from marimo._ast.app_config import _AppConfig
from marimo._runtime.commands import AppMetadata
from marimo._session.managers.ipc import (
    IPCQueueManagerImpl,
    KernelStartupError,
)
from marimo._session.managers.ssh import (
    RemoteComputeTarget,
    SSHKernelManagerImpl,
    _ensure_remote_marimo_installed,
    _prepare_remote_workdir,
    _resolve_remote_workdir,
    _slugify,
)
from marimo._session.model import SessionMode

if TYPE_CHECKING:
    from pathlib import Path


def _target(**overrides: object) -> RemoteComputeTarget:
    defaults: dict[str, object] = {
        "name": "gpu-box",
        "ssh_destination": "user@example.com",
        "remote_python": "/home/user/venv/bin/python",
        "remote_workdir": None,
    }
    defaults.update(overrides)
    return RemoteComputeTarget(**defaults)  # type: ignore[arg-type]


class TestSlugify:
    def test_lowercases_and_strips_punctuation(self) -> None:
        assert _slugify("My Notebook!.py") == "my-notebook-.py"

    def test_empty_falls_back(self) -> None:
        assert _slugify("###") == "notebook"


class TestResolveRemoteWorkdir:
    def test_uses_configured_workdir_if_set(self) -> None:
        target = _target(remote_workdir="/srv/notebooks/foo")
        assert (
            _resolve_remote_workdir(target, "/local/path/notebook.py")
            == "/srv/notebooks/foo"
        )

    def test_defaults_to_slug_under_remote_compute_dir(self) -> None:
        target = _target()
        result = _resolve_remote_workdir(target, "/local/path/My Notebook.py")
        assert result == "~/.marimo/remote_compute/my-notebook"


class TestRemoteComputeTargetFromConfig:
    def test_round_trips_required_and_optional_fields(self) -> None:
        target = RemoteComputeTarget.from_config(
            {
                "name": "gpu-box",
                "ssh_destination": "user@example.com",
                "remote_python": "python3",
                "remote_workdir": "/srv/nb",
            }
        )
        assert target == _target(
            remote_python="python3", remote_workdir="/srv/nb"
        )

    def test_remote_workdir_defaults_to_none(self) -> None:
        target = RemoteComputeTarget.from_config(
            {
                "name": "gpu-box",
                "ssh_destination": "user@example.com",
                "remote_python": "python3",
            }
        )
        assert target.remote_workdir is None


@pytest.mark.requires("zmq")
class TestEnsureRemoteMarimoInstalled:
    def test_passes_when_importable(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        result = MagicMock(returncode=0, stdout="0.1.0\n", stderr="")
        monkeypatch.setattr(
            "marimo._session.managers.ssh._run_ssh", lambda *_a, **_k: result
        )
        _ensure_remote_marimo_installed("user@host", "python3")

    def test_raises_with_install_hint_on_failure(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        result = MagicMock(
            returncode=1, stdout="", stderr="ModuleNotFoundError"
        )
        monkeypatch.setattr(
            "marimo._session.managers.ssh._run_ssh", lambda *_a, **_k: result
        )
        with pytest.raises(
            KernelStartupError, match="pip install marimo pyzmq"
        ):
            _ensure_remote_marimo_installed("user@host", "python3")

    def test_raises_on_timeout(self, monkeypatch: pytest.MonkeyPatch) -> None:
        def _raise(*_a: object, **_k: object) -> None:
            raise subprocess.TimeoutExpired(cmd="ssh", timeout=30)

        monkeypatch.setattr("marimo._session.managers.ssh._run_ssh", _raise)
        with pytest.raises(KernelStartupError, match="Timed out"):
            _ensure_remote_marimo_installed("user@host", "python3")


@pytest.mark.requires("zmq")
class TestPrepareRemoteWorkdir:
    def test_raises_when_mkdir_fails(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        monkeypatch.setattr(
            "marimo._session.managers.ssh._run_ssh",
            lambda *_a, **_k: MagicMock(
                returncode=1, stderr="permission denied"
            ),
        )
        local = tmp_path / "nb.py"
        local.write_text("# marimo notebook")
        with pytest.raises(
            KernelStartupError, match="Could not create remote directory"
        ):
            _prepare_remote_workdir(
                "user@host", "~/.marimo/x", local, "~/.marimo/x/nb.py"
            )

    def test_raises_when_scp_fails(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        monkeypatch.setattr(
            "marimo._session.managers.ssh._run_ssh",
            lambda *_a, **_k: MagicMock(returncode=0, stderr=""),
        )
        monkeypatch.setattr(
            "subprocess.run",
            lambda *_a, **_k: MagicMock(returncode=1, stderr="no such file"),
        )
        local = tmp_path / "nb.py"
        local.write_text("# marimo notebook")
        with pytest.raises(
            KernelStartupError, match="Could not copy the notebook"
        ):
            _prepare_remote_workdir(
                "user@host", "~/.marimo/x", local, "~/.marimo/x/nb.py"
            )


@pytest.mark.requires("zmq")
class TestSSHKernelManagerImpl:
    def _make_manager(self, filename: str | None) -> SSHKernelManagerImpl:
        from marimo._ipc.types import ConnectionInfo

        mock_ipc = MagicMock()
        queue_manager = IPCQueueManagerImpl(mock_ipc)
        connection_info = ConnectionInfo(
            control=1,
            ui_element=2,
            completion=3,
            input=4,
            stream=5,
            win32_interrupt=None,
        )
        app_metadata = AppMetadata(
            query_params={},
            cli_args={},
            app_config=_AppConfig(),
            filename=filename,
        )
        config_manager = MagicMock()
        config_manager.get_config.return_value = {}
        return SSHKernelManagerImpl(
            queue_manager=queue_manager,
            connection_info=connection_info,
            target=_target(),
            mode=SessionMode.EDIT,
            configs={},
            app_metadata=app_metadata,
            config_manager=config_manager,
        )

    def test_start_kernel_requires_saved_file(self) -> None:
        manager = self._make_manager(filename=None)
        with pytest.raises(KernelStartupError, match="saved to a file"):
            manager.start_kernel()

    def test_start_kernel_requires_existing_file(self, tmp_path: Path) -> None:
        manager = self._make_manager(filename=str(tmp_path / "gone.py"))
        with pytest.raises(KernelStartupError, match="not found"):
            manager.start_kernel()

    def test_start_kernel_happy_path_parses_remote_pid(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        notebook = tmp_path / "nb.py"
        notebook.write_text("# marimo notebook")
        manager = self._make_manager(filename=str(notebook))

        monkeypatch.setattr(
            "marimo._session.managers.ssh._ensure_remote_marimo_installed",
            lambda *_a, **_k: None,
        )
        monkeypatch.setattr(
            "marimo._session.managers.ssh._prepare_remote_workdir",
            lambda *_a, **_k: None,
        )

        fake_process = MagicMock()
        fake_process.stdin = MagicMock()
        fake_process.stdout.readline.side_effect = [
            b"MARIMO_REMOTE_PID:4242\n",
            b"KERNEL_READY\n",
        ]
        monkeypatch.setattr("subprocess.Popen", lambda *_a, **_k: fake_process)

        captured_kernel_args: dict[str, object] = {}
        real_kernel_args_cls = __import__(
            "marimo._ipc.types", fromlist=["KernelArgs"]
        ).KernelArgs

        def _capturing_kernel_args(**kwargs: object) -> object:
            captured_kernel_args.update(kwargs)
            return real_kernel_args_cls(**kwargs)

        monkeypatch.setattr(
            "marimo._ipc.types.KernelArgs", _capturing_kernel_args
        )

        manager.start_kernel()

        assert manager._remote_pid == 4242
        assert manager.kernel_task is not None
        assert manager.pid == fake_process.pid
        remote_app_metadata = captured_kernel_args["app_metadata"]
        assert isinstance(remote_app_metadata, AppMetadata)
        assert (
            remote_app_metadata.filename == "~/.marimo/remote_compute/nb/nb.py"
        )

    def test_start_kernel_bad_marker_raises(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        notebook = tmp_path / "nb.py"
        notebook.write_text("# marimo notebook")
        manager = self._make_manager(filename=str(notebook))

        monkeypatch.setattr(
            "marimo._session.managers.ssh._ensure_remote_marimo_installed",
            lambda *_a, **_k: None,
        )
        monkeypatch.setattr(
            "marimo._session.managers.ssh._prepare_remote_workdir",
            lambda *_a, **_k: None,
        )

        fake_process = MagicMock()
        fake_process.stdin = MagicMock()
        fake_process.stdout.readline.side_effect = [b"garbage\n"]
        fake_process.stderr.read.return_value = b"connection refused"
        monkeypatch.setattr("subprocess.Popen", lambda *_a, **_k: fake_process)

        with pytest.raises(
            KernelStartupError, match="Remote kernel failed to start"
        ):
            manager.start_kernel()

    def test_interrupt_kernel_dispatches_sigint(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        manager = self._make_manager(filename=None)
        manager._remote_pid = 999
        calls: list[tuple[str, list[str]]] = []
        monkeypatch.setattr(
            "marimo._session.managers.ssh._run_ssh_fire_and_forget",
            lambda dest, args: calls.append((dest, args)),
        )
        manager.interrupt_kernel()
        assert calls == [("user@example.com", ["kill", "-INT", "999"])]

    def test_interrupt_kernel_noop_without_remote_pid(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        manager = self._make_manager(filename=None)
        calls: list[object] = []
        monkeypatch.setattr(
            "marimo._session.managers.ssh._run_ssh_fire_and_forget",
            lambda *a: calls.append(a),
        )
        manager.interrupt_kernel()
        assert calls == []

    def test_close_kernel_sends_sigterm_and_kills_local_process(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        manager = self._make_manager(filename=None)
        manager._remote_pid = 999
        manager._process = MagicMock()
        manager._process.poll.return_value = None
        manager.kernel_task = MagicMock()

        ssh_calls: list[tuple[str, list[str]]] = []
        monkeypatch.setattr(
            "marimo._session.managers.ssh._run_ssh_fire_and_forget",
            lambda dest, args: ssh_calls.append((dest, args)),
        )
        kill_calls: list[object] = []
        monkeypatch.setattr(
            "marimo._session.managers.ssh.try_kill_process_and_group",
            lambda p: kill_calls.append(p),
        )

        manager.close_kernel()

        assert ssh_calls == [("user@example.com", ["kill", "-TERM", "999"])]
        assert kill_calls == [manager.kernel_task]

    def test_profile_path_is_none(self) -> None:
        manager = self._make_manager(filename=None)
        assert manager.profile_path is None

    def test_is_alive_false_before_start(self) -> None:
        manager = self._make_manager(filename=None)
        assert manager.is_alive() is False

    def test_kernel_connection_raises(self) -> None:
        manager = self._make_manager(filename=None)
        with pytest.raises(NotImplementedError):
            _ = manager.kernel_connection
