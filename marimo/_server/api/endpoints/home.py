# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

import asyncio
import os
import pathlib
import tempfile
from typing import TYPE_CHECKING

from starlette.authentication import requires
from starlette.responses import JSONResponse

from marimo import _loggers
from marimo._server.api.deps import AppState
from marimo._server.api.utils import parse_request
from marimo._server.files.directory_scanner import DirectoryScanner
from marimo._server.models.home import (
    MarimoFile,
    NotebookPreviewCell,
    NotebookPreviewRequest,
    NotebookPreviewResponse,
    OpenTutorialRequest,
    RecentFilesResponse,
    RunningNotebooksResponse,
    ShutdownSessionRequest,
    WorkspaceFilesRequest,
    WorkspaceFilesResponse,
)
from marimo._server.router import APIRouter
from marimo._server.workspace import (
    count_files,
    flatten_files,
)
from marimo._session.model import ConnectionState, SessionMode
from marimo._tutorials import create_temp_tutorial_file  # type: ignore
from marimo._utils.http import HTTPException, HTTPStatus
from marimo._utils.paths import pretty_path

if TYPE_CHECKING:
    from starlette.requests import Request

MAX_FILES = DirectoryScanner.MAX_FILES

LOGGER = _loggers.marimo_logger()

# Router for home endpoints
router = APIRouter()


@router.post("/recent_files")
@requires("edit")
async def read_code(
    *,
    request: Request,
) -> RecentFilesResponse:
    """
    responses:
        200:
            description: Get the recent files
            content:
                application/json:
                    schema:
                        $ref: "#/components/schemas/RecentFilesResponse"
    """
    app_state = AppState(request)
    # Pass the workspace's directory to filter and relativize paths
    directory = None
    dir_str = app_state.session_manager.workspace.directory
    if dir_str:
        directory = pathlib.Path(dir_str)
    files = app_state.session_manager.recents.get_recents(directory)
    return RecentFilesResponse(files=files)


@router.post("/workspace_files")
@requires("read")
async def workspace_files(
    *,
    request: Request,
) -> WorkspaceFilesResponse:
    """
    requestBody:
        content:
            application/json:
                schema:
                    $ref: "#/components/schemas/WorkspaceFilesRequest"
    responses:
        200:
            description: Get the files in the workspace
            content:
                application/json:
                    schema:
                        $ref: "#/components/schemas/WorkspaceFilesResponse"
    """
    body = await parse_request(request, cls=WorkspaceFilesRequest)
    app_state = AppState(request)
    session_manager = app_state.session_manager

    if session_manager.mode == SessionMode.RUN:
        from marimo._metadata.opengraph import (
            OpenGraphContext,
            resolve_opengraph_metadata,
        )
        from marimo._server.models.files import FileInfo

        if session_manager.watch:
            # In watched folder mode, refresh the index to include new/removed files since the previous request.
            session_manager.workspace.invalidate()

        base_url = app_state.base_url
        mode = session_manager.mode.value

        def get_files_with_metadata() -> list[FileInfo]:
            files = session_manager.workspace.files
            marimo_files = [
                file for file in flatten_files(files) if file.is_marimo_file
            ]
            result: list[FileInfo] = []
            for file in marimo_files:
                try:
                    resolved_path = session_manager.workspace.resolve(
                        file.path
                    )
                except HTTPException as e:
                    if e.status_code == HTTPStatus.NOT_FOUND:
                        continue
                    raise
                opengraph = None
                if resolved_path is not None:
                    # User-defined OpenGraph generators receive this context for dynamic metadata
                    opengraph = resolve_opengraph_metadata(
                        resolved_path,
                        context=OpenGraphContext(
                            filepath=resolved_path,
                            file_key=file.path,
                            base_url=base_url,
                            mode=mode,
                        ),
                    )
                result.append(
                    FileInfo(
                        id=file.id,
                        path=file.path,
                        name=file.name,
                        is_directory=file.is_directory,
                        is_marimo_file=file.is_marimo_file,
                        last_modified=file.last_modified,
                        children=file.children,
                        opengraph=opengraph,
                    )
                )
            return result

        marimo_files = await asyncio.to_thread(get_files_with_metadata)
        file_count = len(marimo_files)
        has_more = file_count >= MAX_FILES
        return WorkspaceFilesResponse(
            files=marimo_files,
            root=session_manager.workspace.directory or "",
            has_more=has_more,
            file_count=file_count,
        )

    # Both calls are no-ops on workspaces that don't support these
    # capabilities (single-file, fixed-files, empty).
    session_manager.workspace.invalidate()
    session_manager.workspace.set_include_markdown(body.include_markdown)
    root = session_manager.workspace.directory or ""

    # Run file scanning in thread pool to avoid blocking the server
    files = await asyncio.to_thread(lambda: session_manager.workspace.files)

    file_count = count_files(files)
    has_more = file_count >= MAX_FILES

    return WorkspaceFilesResponse(
        files=files,
        root=root,
        has_more=has_more,
        file_count=file_count,
    )


# --- Notebook previews (home-page thumbnails) -----------------------------
#
# A lightweight, execution-free structural preview of a notebook's top: its
# title and the first few cells (type + a snippet), used to render a "mini
# mockup" thumbnail on the home page. Parsing is static (no kernel), so this
# is cheap and safe to call per visible card.

PREVIEW_MAX_CELLS = 6
PREVIEW_MAX_MARKDOWN = 240
PREVIEW_MAX_CODE_LINES = 5
PREVIEW_MAX_LINE_LEN = 64
# Skip parsing very large files to keep the endpoint snappy.
PREVIEW_MAX_BYTES = 2_000_000

_CHART_HINTS = (
    "alt.chart",
    ".mark_",
    "altair",
    "plt.",
    "px.",
    "plotly",
    ".plot(",
    "sns.",
    "go.figure",
    "hvplot",
    "altair_chart",
)
_WIDGET_HINTS = (
    "mo.ui.",
    "mo.hstack",
    "mo.vstack",
    "mo.tabs",
    "mo.accordion",
    "mo.callout",
)
_TABLE_HINTS = (
    "pd.dataframe",
    ".head(",
    ".describe(",
    "st.dataframe",
    "pl.dataframe",
)


def _visual_hint(code: str, cell_type: str) -> str:
    """Heuristic guess at what a cell renders, for a placeholder glyph."""
    if cell_type == "sql":
        return "table"
    low = code.lower()
    if any(hint in low for hint in _CHART_HINTS):
        return "chart"
    if "mo.ui.table" in low or "mo.ui.dataframe" in low:
        return "table"
    if any(hint in low for hint in _WIDGET_HINTS):
        return "widget"
    if any(hint in low for hint in _TABLE_HINTS):
        return "table"
    return "none"


def _classify_cell(code: str) -> tuple[str, str | None, list[str]]:
    """Return (cell_type, markdown_text_or_none, code_lines)."""
    from marimo._ast.compiler import extract_markdown

    markdown = extract_markdown(code)
    if markdown is not None:
        return "markdown", markdown[:PREVIEW_MAX_MARKDOWN], []

    cell_type = "sql" if "mo.sql(" in code else "python"
    lines: list[str] = []
    for raw in code.splitlines():
        stripped = raw.rstrip()
        if not stripped.strip():
            continue
        lines.append(stripped[:PREVIEW_MAX_LINE_LEN])
        if len(lines) >= PREVIEW_MAX_CODE_LINES:
            break
    return cell_type, None, lines


def _first_heading(markdown: str) -> str | None:
    """The notebook's title: the heading atop its first markdown cell."""
    for line in markdown.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            return stripped.lstrip("#").strip() or None
        # First non-empty line isn't a heading — this cell has no title.
        return None
    return None


def _build_notebook_preview(path: str) -> NotebookPreviewResponse:
    from marimo._ast.parse import parse_notebook

    try:
        if os.path.getsize(path) > PREVIEW_MAX_BYTES:
            return NotebookPreviewResponse()
        contents = pathlib.Path(path).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return NotebookPreviewResponse()

    try:
        notebook = parse_notebook(contents, filepath=path)
    except Exception:
        LOGGER.debug("Failed to parse preview for %s", path, exc_info=True)
        return NotebookPreviewResponse()
    if notebook is None:
        return NotebookPreviewResponse()

    cells = notebook.cells
    preview_cells: list[NotebookPreviewCell] = []
    # Prefer the notebook's configured title (App(app_title="...")). The first
    # markdown heading is only a fallback — it's usually a section like "Setup",
    # not the notebook's name.
    app_title = notebook.app.options.get("app_title")
    title: str | None = (
        app_title.strip()
        if isinstance(app_title, str) and app_title.strip()
        else None
    )
    for cell in cells[:PREVIEW_MAX_CELLS]:
        cell_type, markdown, lines = _classify_cell(cell.code)
        if title is None and markdown is not None:
            title = _first_heading(markdown)
        preview_cells.append(
            NotebookPreviewCell(
                cell_type=cell_type,
                visual=_visual_hint(cell.code, cell_type),
                markdown=markdown,
                lines=lines,
            )
        )
    return NotebookPreviewResponse(
        title=title,
        cells=preview_cells,
        total_cells=len(cells),
    )


@router.post("/notebook_preview")
@requires("read")
async def notebook_preview(
    *,
    request: Request,
) -> NotebookPreviewResponse:
    """
    requestBody:
        content:
            application/json:
                schema:
                    $ref: "#/components/schemas/NotebookPreviewRequest"
    responses:
        200:
            description: A lightweight structural preview of a notebook
            content:
                application/json:
                    schema:
                        $ref: "#/components/schemas/NotebookPreviewResponse"
    """
    body = await parse_request(request, cls=NotebookPreviewRequest)
    app_state = AppState(request)
    session_manager = app_state.session_manager

    # Don't disclose notebook source when code is meant to be hidden
    # (e.g. `marimo run` without --include-code), matching read_code/export.
    if not session_manager.should_send_code_to_frontend():
        return NotebookPreviewResponse()

    workspace = session_manager.workspace
    # Previews are a directory-gallery feature. Only DirectoryWorkspace has a
    # root and enforces path containment on resolve(); refuse the other
    # workspace kinds so a preview request can't read a file outside a
    # workspace (e.g. EmptyWorkspace.resolve resolves arbitrary paths).
    if workspace.directory is None:
        return NotebookPreviewResponse()

    try:
        resolved = workspace.resolve(body.file)
    except HTTPException:
        # Outside the workspace (or missing) — no preview, card shows fallback.
        resolved = None
    if not resolved:
        return NotebookPreviewResponse()

    return await asyncio.to_thread(_build_notebook_preview, resolved)


def _get_active_sessions(app_state: AppState) -> list[MarimoFile]:
    """Get list of active sessions with prettified paths."""
    # Get directory from workspace for path relativization
    base_dir = app_state.session_manager.workspace.directory

    files: list[MarimoFile] = []
    for session_id, session in app_state.session_manager.sessions.items():
        state = session.connection_state()
        if state == ConnectionState.OPEN or state == ConnectionState.ORPHANED:
            filename = session.app_file_manager.filename
            basename = os.path.basename(filename) if filename else None
            files.append(
                MarimoFile(
                    name=(basename or "new notebook"),
                    path=pretty_path(filename, base_dir)
                    if filename
                    else session_id,
                    last_modified=0,
                    session_id=session_id,
                    initialization_id=session.initialization_id,
                )
            )
    # These are better in reverse
    return files[::-1]


@router.post("/running_notebooks")
@requires("edit")
async def running_notebooks(
    *,
    request: Request,
) -> RunningNotebooksResponse:
    """
    responses:
        200:
            description: Get the running files
            content:
                application/json:
                    schema:
                        $ref: "#/components/schemas/RunningNotebooksResponse"
    """
    app_state = AppState(request)
    return RunningNotebooksResponse(files=_get_active_sessions(app_state))


@router.post("/shutdown_session")
@requires("edit")
async def shutdown_session(
    *,
    request: Request,
) -> RunningNotebooksResponse:
    """
    requestBody:
        content:
            application/json:
                schema:
                    $ref: "#/components/schemas/ShutdownSessionRequest"
    responses:
        200:
            description: Shutdown the current session
            content:
                application/json:
                    schema:
                        $ref: "#/components/schemas/RunningNotebooksResponse"
    """
    app_state = AppState(request)
    body = await parse_request(request, cls=ShutdownSessionRequest)
    app_state.session_manager.close_session(body.session_id)
    return RunningNotebooksResponse(files=_get_active_sessions(app_state))


@router.post("/tutorial/open")
@requires("edit")
async def tutorial(
    *,
    request: Request,
) -> MarimoFile | JSONResponse:
    """
    requestBody:
        content:
            application/json:
                schema:
                    $ref: "#/components/schemas/OpenTutorialRequest"
    responses:
        200:
            description: Open a new tutorial
            content:
                application/json:
                    schema:
                        $ref: "#/components/schemas/MarimoFile"
    """
    import msgspec

    # Create a new tutorial file and return the filepath
    try:
        body = await parse_request(request, cls=OpenTutorialRequest)
    except msgspec.ValidationError:
        return JSONResponse({"detail": "Tutorial not found"}, status_code=400)
    temp_dir = tempfile.TemporaryDirectory()
    path = create_temp_tutorial_file(body.tutorial_id, temp_dir)

    import atexit

    atexit.register(temp_dir.cleanup)

    # Register the temp file/directory with the workspace so it can be accessed.
    # Each method is a no-op on workspaces that don't support that capability.
    app_state = AppState(request)
    app_state.session_manager.workspace.register_temp_dir(temp_dir.name)
    app_state.session_manager.workspace.register_allowed_path(
        path.absolute_name
    )

    return MarimoFile(
        name=os.path.basename(path.absolute_name),
        path=path.absolute_name,
    )
