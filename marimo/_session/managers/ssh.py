# Copyright 2026 Marimo. All rights reserved.
"""SSH-based remote-compute kernel manager.

Launches the kernel as a subprocess on a remote machine over SSH and
communicates with it using the same ZeroMQ IPC protocol as the local IPC
kernel manager (`marimo._session.managers.ipc`), tunneled back to this
machine with SSH remote port forwarding (`ssh -R`). Since the IPC protocol
already has the *kernel* connect out to `127.0.0.1:<port>` while the
*server* binds those ports first, remote-forwarding those same ports is
enough to reuse the existing ZeroMQ handshake unmodified -- only the
subprocess launch command differs from the local IPC path.

marimo shells out to the system `ssh`/`scp` binaries rather than depending
on a Python SSH library. This means all of the user's own SSH
configuration (keys, agent forwarding, `ProxyJump`, 2FA, `Host` aliases in
`~/.ssh/config`) is used automatically, and marimo never has to manage
private keys or passphrases itself.

Unlike the local IPC sandbox path, marimo does not build or manage a
virtual environment on the remote host: `remote_python` must already have
marimo and its IPC dependencies (`pyzmq`) installed.
"""

from __future__ import annotations

import dataclasses
import os
import shlex
import subprocess
import sys
import threading
from pathlib import Path
from typing import TYPE_CHECKING, NoReturn

import msgspec.structs

from marimo import _loggers
from marimo._config.settings import GLOBAL_SETTINGS
from marimo._runtime import commands
from marimo._session.managers._subprocess_wrapper import SubprocessWrapper
from marimo._session.managers.ipc import (
    IPCQueueManagerImpl,
    KernelStartupError,
)
from marimo._session.model import SessionMode
from marimo._session.queue import ProcessLike
from marimo._session.types import KernelManager
from marimo._utils.subprocess import try_kill_process_and_group
from marimo._utils.typed_connection import TypedConnection
from marimo._version import __version__

if TYPE_CHECKING:
    from marimo._ast.cell import CellConfig
    from marimo._config.config import RemoteComputeTargetConfig
    from marimo._config.manager import MarimoConfigReader
    from marimo._ipc.types import ConnectionInfo
    from marimo._messaging.types import KernelMessage
    from marimo._runtime.commands import AppMetadata
    from marimo._types.ids import CellId_t

LOGGER = _loggers.marimo_logger()

# Prefix for the extra line the remote command writes to stdout, before the
# existing (and unmodified) "KERNEL_READY" contract from launch_kernel.py.
# Lets us learn the remote kernel's PID without touching that public API.
_REMOTE_MARKER_PREFIX = "MARIMO_REMOTE_PID:"

_DEFAULT_REMOTE_WORKDIR_ROOT = "~/.marimo/remote_compute"

# BatchMode disables interactive prompts (password/passphrase), so a broken
# connection fails fast instead of hanging a background subprocess we can't
# interact with. ExitOnForwardFailure makes ssh exit immediately if a -R
# port can't be bound remotely, rather than silently continuing without it.
_SSH_OPTS = [
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=10",
]
_LAUNCH_SSH_OPTS = [*_SSH_OPTS, "-o", "ExitOnForwardFailure=yes"]


@dataclasses.dataclass(frozen=True)
class RemoteComputeTarget:
    """A resolved remote-compute target: a named SSH destination that a
    notebook's kernel can be launched on."""

    name: str
    ssh_destination: str
    remote_python: str
    remote_workdir: str | None = None

    @classmethod
    def from_config(
        cls, config: RemoteComputeTargetConfig
    ) -> RemoteComputeTarget:
        return cls(
            name=config["name"],
            ssh_destination=config["ssh_destination"],
            remote_python=config["remote_python"],
            remote_workdir=config.get("remote_workdir"),
        )


def _slugify(name: str) -> str:
    slug = "".join(
        c if c.isalnum() or c in "._-" else "-" for c in name.lower()
    )
    slug = slug.strip("-")
    return slug or "notebook"


def _resolve_remote_workdir(target: RemoteComputeTarget, filename: str) -> str:
    if target.remote_workdir:
        return target.remote_workdir
    slug = _slugify(Path(filename).stem)
    return f"{_DEFAULT_REMOTE_WORKDIR_ROOT}/{slug}"


def _run_ssh(
    destination: str, remote_args: list[str], *, timeout: float
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["ssh", *_SSH_OPTS, destination, *remote_args],
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def _run_ssh_fire_and_forget(destination: str, remote_args: list[str]) -> None:
    """Run a short remote command on a daemon thread, best-effort.

    Used for interrupt/close signals so a slow or dropped SSH connection
    never blocks the asyncio event loop thread that calls into us.
    """

    def _target() -> None:
        try:
            _run_ssh(destination, remote_args, timeout=10)
        except Exception as e:
            LOGGER.debug("SSH command %s failed: %s", remote_args, e)

    threading.Thread(target=_target, daemon=True).start()


def _ensure_remote_marimo_installed(
    destination: str, remote_python: str
) -> None:
    try:
        result = _run_ssh(
            destination,
            [
                remote_python,
                "-c",
                "import marimo, msgspec, zmq; print(marimo.__version__)",
            ],
            timeout=30,
        )
    except subprocess.TimeoutExpired as e:
        raise KernelStartupError(
            f"Timed out connecting to {destination!r} over SSH."
        ) from e
    if result.returncode != 0:
        raise KernelStartupError(
            f"Could not find marimo on {destination!r} using "
            f"{remote_python!r}.\n\n"
            f"Install marimo and pyzmq on the remote host, e.g.:\n"
            f"  ssh {destination} {remote_python} -m pip install marimo pyzmq\n\n"
            f"Stderr:\n{result.stderr}"
        )
    remote_version = result.stdout.strip()
    if remote_version and remote_version != __version__:
        LOGGER.warning(
            "marimo version mismatch: %r has %s, current is %s. "
            "Consider upgrading both to the same version.",
            destination,
            remote_version,
            __version__,
        )


def _prepare_remote_workdir(
    destination: str, remote_workdir: str, local_path: Path, remote_file: str
) -> None:
    try:
        result = _run_ssh(
            destination, ["mkdir", "-p", remote_workdir], timeout=15
        )
    except subprocess.TimeoutExpired as e:
        raise KernelStartupError(
            f"Timed out connecting to {destination!r} over SSH."
        ) from e
    if result.returncode != 0:
        raise KernelStartupError(
            f"Could not create remote directory {remote_workdir!r} on "
            f"{destination!r}.\n\nStderr:\n{result.stderr}"
        )

    try:
        result = subprocess.run(
            [
                "scp",
                *_SSH_OPTS,
                str(local_path),
                f"{destination}:{remote_file}",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except subprocess.TimeoutExpired as e:
        raise KernelStartupError(
            f"Timed out copying the notebook to {destination!r}."
        ) from e
    if result.returncode != 0:
        raise KernelStartupError(
            f"Could not copy the notebook to {destination}:{remote_file}.\n\n"
            f"Stderr:\n{result.stderr}"
        )


class SSHKernelManagerImpl(KernelManager):
    """Remote-compute kernel manager: launches the kernel over SSH.

    Reuses `IPCQueueManagerImpl` and the ZeroMQ wire protocol unmodified;
    only the subprocess launch command (a port-forwarded `ssh` invocation
    instead of a direct local `Popen`) and PID bookkeeping differ from
    `IPCKernelManagerImpl`.
    """

    def __init__(
        self,
        *,
        queue_manager: IPCQueueManagerImpl,
        connection_info: ConnectionInfo,
        target: RemoteComputeTarget,
        mode: SessionMode,
        configs: dict[CellId_t, CellConfig],
        app_metadata: AppMetadata,
        config_manager: MarimoConfigReader,
        redirect_console_to_browser: bool = True,
    ) -> None:
        self.queue_manager = queue_manager
        self.connection_info = connection_info
        self.target = target
        self.mode = mode
        self.configs = configs
        self.app_metadata = app_metadata
        self.config_manager = config_manager
        self.redirect_console_to_browser = redirect_console_to_browser

        self._process: subprocess.Popen[bytes] | None = None
        self.kernel_task: ProcessLike | None = None
        self._remote_pid: int | None = None

    def start_kernel(self) -> None:
        from marimo._cli.print import echo, muted
        from marimo._ipc.types import KernelArgs

        if sys.platform == "win32":
            raise KernelStartupError(
                "Remote compute over SSH is not yet supported when the "
                "marimo server itself is running on Windows."
            )

        filename = self.app_metadata.filename
        if not filename:
            raise KernelStartupError(
                "Remote compute requires the notebook to be saved to a "
                "file first."
            )
        local_path = Path(filename)
        if not local_path.exists():
            raise KernelStartupError(f"Notebook file not found: {filename}")

        destination = self.target.ssh_destination
        remote_python = self.target.remote_python
        remote_workdir = _resolve_remote_workdir(self.target, filename)
        remote_file = f"{remote_workdir}/{local_path.name}"

        echo(
            f"Connecting to remote target {muted(self.target.name)} "
            f"({muted(destination)})...",
            err=True,
        )

        _ensure_remote_marimo_installed(destination, remote_python)
        _prepare_remote_workdir(
            destination, remote_workdir, local_path, remote_file
        )

        # sys.path / mo.notebook_dir() inside the kernel resolve relative to
        # `filename`, so it must point at the notebook's copy on the remote
        # filesystem, not the original local path.
        remote_app_metadata = msgspec.structs.replace(
            self.app_metadata, filename=remote_file
        )

        kernel_args = KernelArgs(
            configs=self.configs,
            app_metadata=remote_app_metadata,
            user_config=self.config_manager.get_config(hide_secrets=False),
            log_level=GLOBAL_SETTINGS.LOG_LEVEL,
            profile_path=None,
            connection_info=self.connection_info,
            is_run_mode=self.mode == SessionMode.RUN,
            redirect_console_to_browser=self.redirect_console_to_browser,
            parent_pid=os.getpid(),
        )

        # `$$` is the shell's own PID; since `exec` replaces the shell's
        # process image rather than forking, that PID is still the kernel
        # process's PID once launch_kernel.py takes over.
        remote_cmd = (
            f"cd {shlex.quote(remote_workdir)} && "
            f'echo "{_REMOTE_MARKER_PREFIX}$$" && '
            f"exec {shlex.quote(remote_python)} -m marimo._ipc.launch_kernel"
        )

        forward_ports = [
            self.connection_info.control,
            self.connection_info.ui_element,
            self.connection_info.completion,
            self.connection_info.input,
            self.connection_info.stream,
        ]
        if self.connection_info.win32_interrupt is not None:
            forward_ports.append(self.connection_info.win32_interrupt)

        cmd: list[str] = ["ssh", *_LAUNCH_SSH_OPTS]
        for port in forward_ports:
            cmd += ["-R", f"{port}:127.0.0.1:{port}"]
        cmd += [destination, remote_cmd]

        LOGGER.debug("Launching remote kernel: %s", " ".join(cmd))

        try:
            self._process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=os.environ.copy(),
            )

            assert self._process.stdin is not None
            self._process.stdin.write(kernel_args.encode_json())
            self._process.stdin.flush()
            self._process.stdin.close()

            assert self._process.stdout is not None
            marker_line = self._process.stdout.readline().decode().strip()
            if not marker_line.startswith(_REMOTE_MARKER_PREFIX):
                self._raise_startup_error(cmd, marker_line)
            try:
                self._remote_pid = int(
                    marker_line[len(_REMOTE_MARKER_PREFIX) :]
                )
            except ValueError:
                self._raise_startup_error(cmd, marker_line)

            ready = self._process.stdout.readline().decode().strip()
            if ready != "KERNEL_READY":
                self._raise_startup_error(cmd, ready)

            LOGGER.debug(
                "Remote kernel ready on %s (remote pid %s)",
                destination,
                self._remote_pid,
            )
            self.kernel_task = SubprocessWrapper(self._process)
        except KernelStartupError:
            raise
        except Exception as e:
            raise KernelStartupError(
                f"Failed to start remote kernel over SSH.\n\n{e}"
            ) from e

    def _raise_startup_error(self, cmd: list[str], got_line: str) -> NoReturn:
        assert self._process is not None
        assert self._process.stderr is not None
        stderr = self._process.stderr.read().decode()
        raise KernelStartupError(
            f"Remote kernel failed to start.\n\n"
            f"Command: {' '.join(cmd)}\n\n"
            f"Unexpected output: {got_line!r}\n\n"
            f"Stderr:\n{stderr}"
        )

    @property
    def pid(self) -> int | None:
        """PID of the local `ssh` client, not the remote kernel process."""
        if self._process is None:
            return None
        return self._process.pid

    @property
    def profile_path(self) -> str | None:
        # Profiling not currently supported for remote kernels.
        return None

    def is_alive(self) -> bool:
        if self._process is None:
            return False
        return self._process.poll() is None

    def interrupt_kernel(self) -> None:
        if self._remote_pid is None:
            return
        LOGGER.debug(
            "Sending SIGINT to remote kernel pid %s", self._remote_pid
        )
        _run_ssh_fire_and_forget(
            self.target.ssh_destination,
            ["kill", "-INT", str(self._remote_pid)],
        )

    def close_kernel(self) -> None:
        if self._process is not None:
            self.queue_manager.put_control_request(
                commands.StopKernelCommand()
            )
            self.queue_manager.close_queues()
            if self._remote_pid is not None:
                _run_ssh_fire_and_forget(
                    self.target.ssh_destination,
                    ["kill", "-TERM", str(self._remote_pid)],
                )
            if self._process.poll() is None and self.kernel_task is not None:
                try:
                    try_kill_process_and_group(self.kernel_task)
                except ProcessLookupError:
                    pass
                except Exception as e:
                    LOGGER.warning(e)

    @property
    def kernel_connection(self) -> TypedConnection[KernelMessage]:
        # SSH kernel uses stream_queue instead of kernel_connection, same
        # as the local IPC kernel.
        raise NotImplementedError(
            "SSH kernel uses stream_queue, not kernel_connection"
        )
