# Copyright 2026 Marimo. All rights reserved.
"""Request/response models for the per-notebook git version history feature."""

from __future__ import annotations

import msgspec

from marimo._server.models.models import BaseResponse


class GitCommitInfo(msgspec.Struct, rename="camel"):
    commit_hash: str
    date: str
    message: str


class GitLogResponse(msgspec.Struct, rename="camel"):
    # False when git isn't installed, or the notebook has no file path yet
    # (never been saved) — the frontend uses this to distinguish "history
    # isn't available here" from "no commits yet".
    available: bool
    commits: list[GitCommitInfo]


class GitShowRequest(msgspec.Struct, rename="camel"):
    commit_hash: str


class GitShowResponse(msgspec.Struct, rename="camel"):
    content: str | None = None


class GitCommitRequest(msgspec.Struct, rename="camel"):
    message: str


class GitCommitResponse(BaseResponse):
    commit: GitCommitInfo | None = None
    message: str | None = None


class GitRestoreRequest(msgspec.Struct, rename="camel"):
    commit_hash: str


class GitRestoreResponse(BaseResponse):
    message: str | None = None
