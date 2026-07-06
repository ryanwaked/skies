# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

import msgspec

from marimo._server.models.files import FileInfo
from marimo._tutorials import Tutorial  # type: ignore
from marimo._types.ids import SessionId


class MarimoFile(msgspec.Struct, rename="camel"):
    # Name of the file
    name: str
    # Absolute path to the file
    path: str
    # Last modified time of the file
    last_modified: float | None = None
    # Session id
    session_id: SessionId | None = None
    # Session initialization id
    # This is the ID for when the session was initialized
    initialization_id: str | None = None


class RecentFilesResponse(msgspec.Struct, rename="camel"):
    files: list[MarimoFile]


class RunningNotebooksResponse(msgspec.Struct, rename="camel"):
    files: list[MarimoFile]


class OpenTutorialRequest(msgspec.Struct, rename="camel"):
    tutorial_id: Tutorial


class WorkspaceFilesRequest(msgspec.Struct, rename="camel"):
    include_markdown: bool = False


class WorkspaceFilesResponse(msgspec.Struct, rename="camel"):
    root: str
    files: list[FileInfo]
    # Indicates if limit was reached
    has_more: bool = False
    # Total files found
    file_count: int = 0


class ShutdownSessionRequest(msgspec.Struct, rename="camel"):
    session_id: SessionId


class NotebookPreviewRequest(msgspec.Struct, rename="camel"):
    # Workspace file key (path relative to the workspace root, or absolute).
    file: str


class NotebookPreviewCell(msgspec.Struct, rename="camel"):
    # One of "markdown", "python", "sql".
    cell_type: str
    # Heuristic hint for a rendered output: "chart", "table", "widget", "none".
    visual: str = "none"
    # For markdown cells: the rendered markdown text (leading `#` headings kept),
    # truncated for preview.
    markdown: str | None = None
    # For code/sql cells: the first few source lines, each truncated.
    lines: list[str] = msgspec.field(default_factory=list)


class NotebookPreviewResponse(msgspec.Struct, rename="camel"):
    # The notebook's title (its first markdown heading), if any.
    title: str | None = None
    # The first several cells, in order, as a lightweight structural preview.
    cells: list[NotebookPreviewCell] = msgspec.field(default_factory=list)
    # Total number of cells in the notebook.
    total_cells: int = 0
