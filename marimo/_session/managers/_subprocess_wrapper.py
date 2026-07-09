# Copyright 2026 Marimo. All rights reserved.
"""Shared ProcessLike wrapper for subprocess-backed kernel managers.

Used by both the local IPC kernel manager (wrapping a directly-spawned
kernel subprocess) and the SSH remote-compute kernel manager (wrapping the
local `ssh` client subprocess that tunnels to the remote kernel).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from marimo._session.queue import ProcessLike

if TYPE_CHECKING:
    import subprocess


class SubprocessWrapper(ProcessLike):
    """Wrapper to make subprocess.Popen compatible with ProcessLike."""

    def __init__(self, process: subprocess.Popen[bytes]) -> None:
        self._process = process

    @property
    def pid(self) -> int | None:
        return self._process.pid

    @property
    def exitcode(self) -> int | None:
        """Mirror multiprocessing.Process.exitcode for exit diagnostics."""
        return self._process.poll()

    def is_alive(self) -> bool:
        return self._process.poll() is None

    def terminate(self) -> None:
        self._process.terminate()

    def kill(self) -> None:
        self._process.kill()

    def join(self, timeout: float | None = None) -> None:
        self._process.wait(timeout=timeout)
