# Copyright 2026 Marimo. All rights reserved.
"""Tests for `marimo edit`'s default-directory resolution."""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

from marimo._cli import cli as cli_mod

if TYPE_CHECKING:
    from pathlib import Path

    import pytest


class _FakeManager:
    def __init__(self, value: str) -> None:
        self._value = value

    def get_config(self) -> dict:
        return {"server": {"default_notebook_directory": self._value}}


def _patch_config(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    monkeypatch.setattr(
        "marimo._config.manager.get_default_config_manager",
        lambda **_kwargs: _FakeManager(value),
    )


def _patch_desktop(
    monkeypatch: pytest.MonkeyPatch, target: str | None
) -> None:
    """Map `~/Desktop` to `target` (or a non-existent path when None)."""
    resolved = target if target is not None else "/definitely/not/a/dir"
    monkeypatch.setattr(
        os.path,
        "expanduser",
        lambda p: resolved if p == "~/Desktop" else p,
    )


def test_uses_configured_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_config(monkeypatch, str(tmp_path))
    assert cli_mod._resolve_default_edit_directory() == str(tmp_path)


def test_configured_missing_dir_falls_back_to_desktop(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_config(monkeypatch, "/nope/not/here")
    desktop = tmp_path / "Desktop"
    desktop.mkdir()
    _patch_desktop(monkeypatch, str(desktop))
    assert cli_mod._resolve_default_edit_directory() == str(desktop)


def test_empty_config_uses_desktop(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_config(monkeypatch, "")
    desktop = tmp_path / "Desktop"
    desktop.mkdir()
    _patch_desktop(monkeypatch, str(desktop))
    assert cli_mod._resolve_default_edit_directory() == str(desktop)


def test_no_desktop_falls_back_to_cwd(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_config(monkeypatch, "")
    _patch_desktop(monkeypatch, None)
    monkeypatch.setattr(os, "getcwd", lambda: str(tmp_path))
    assert cli_mod._resolve_default_edit_directory() == str(tmp_path)


def test_config_error_falls_back_gracefully(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _boom(**_kwargs: object) -> _FakeManager:
        raise RuntimeError("config unavailable")

    monkeypatch.setattr(
        "marimo._config.manager.get_default_config_manager", _boom
    )
    desktop = tmp_path / "Desktop"
    desktop.mkdir()
    _patch_desktop(monkeypatch, str(desktop))
    assert cli_mod._resolve_default_edit_directory() == str(desktop)
