# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from starlette.authentication import requires

from marimo import _loggers
from marimo._server.api.deps import AppState
from marimo._server.api.utils import parse_request
from marimo._server.models.git_history import (
    GitCommitInfo,
    GitCommitRequest,
    GitCommitResponse,
    GitCreateRemoteRequest,
    GitCreateRemoteResponse,
    GitLogResponse,
    GitRestoreRequest,
    GitRestoreResponse,
    GitShowRequest,
    GitShowResponse,
    GitVerifyProviderResponse,
)
from marimo._server.router import APIRouter
from marimo._session.file_change_handler import create_reload_strategy
from marimo._utils.git_providers import (
    GitHubClient,
    GitProviderError,
    get_github_token,
)
from marimo._utils.notebook_git_history import (
    GitCommitRecord,
    NotebookGitHistory,
)

if TYPE_CHECKING:
    from starlette.requests import Request

LOGGER = _loggers.marimo_logger()

# Router for the per-notebook git version-history endpoints
router = APIRouter()


def _record_to_info(record: GitCommitRecord) -> GitCommitInfo:
    return GitCommitInfo(
        commit_hash=record.commit_hash, date=record.date, message=record.message
    )


def _history_for_current_session(
    request: Request,
) -> tuple[NotebookGitHistory | None, str | None]:
    """Resolve the git-history manager for the currently open notebook.

    Returns `(None, error_message)` when the notebook has no file path yet
    (an unnamed/unsaved notebook has nothing to track).
    """
    app_state = AppState(request)
    session = app_state.require_current_session()
    path = session.app_file_manager.path
    if path is None:
        return None, "Save this notebook before viewing its history."
    return NotebookGitHistory(path), None


@router.post("/log")
@requires("edit")
async def git_log(request: Request) -> GitLogResponse:
    """
    parameters:
        - in: header
          name: Marimo-Session-Id
          schema:
            type: string
          required: true
    responses:
        200:
            description: List the notebook's version history, most recent first
            content:
                application/json:
                    schema:
                        $ref: "#/components/schemas/GitLogResponse"
    """
    history, _error = _history_for_current_session(request)
    if history is None or not history.is_available:
        return GitLogResponse(available=False, commits=[])
    commits = [_record_to_info(r) for r in history.log()]
    return GitLogResponse(
        available=True,
        commits=commits,
        has_remote=history.has_remote(),
        remote_url=history.remote_url(),
    )


@router.post("/show")
@requires("edit")
async def git_show(request: Request) -> GitShowResponse:
    """
    parameters:
        - in: header
          name: Marimo-Session-Id
          schema:
            type: string
          required: true
    requestBody:
        required: true
        content:
            application/json:
                schema:
                    $ref: "#/components/schemas/GitShowRequest"
    responses:
        200:
            description: Get the notebook source as of a given commit
            content:
                application/json:
                    schema:
                        $ref: "#/components/schemas/GitShowResponse"
    """
    body = await parse_request(request, cls=GitShowRequest)
    history, _error = _history_for_current_session(request)
    if history is None:
        return GitShowResponse(content=None)
    return GitShowResponse(content=history.show(body.commit_hash))


@router.post("/commit")
@requires("edit")
async def git_commit(request: Request) -> GitCommitResponse:
    """
    parameters:
        - in: header
          name: Marimo-Session-Id
          schema:
            type: string
          required: true
    requestBody:
        required: true
        content:
            application/json:
                schema:
                    $ref: "#/components/schemas/GitCommitRequest"
    responses:
        200:
            description: Commit the notebook's current saved content with a message
            content:
                application/json:
                    schema:
                        $ref: "#/components/schemas/GitCommitResponse"
    """
    body = await parse_request(request, cls=GitCommitRequest)
    history, error = _history_for_current_session(request)
    if history is None:
        return GitCommitResponse(success=False, message=error)
    if not history.is_available:
        return GitCommitResponse(
            success=False, message="git is not installed on this machine."
        )

    app_state = AppState(request)
    session = app_state.require_current_session()
    content = session.app_file_manager.read_file()
    record = history.commit(content, body.message)
    if record is None:
        return GitCommitResponse(
            success=False,
            message="Nothing to commit — the notebook hasn't changed since the last version.",
        )

    pushed = False
    if history.has_remote():
        token = get_github_token(
            app_state.config_manager.get_config(hide_secrets=False)
        )
        if token:
            pushed = history.push(token)
    return GitCommitResponse(
        success=True, commit=_record_to_info(record), pushed=pushed
    )


@router.post("/restore")
@requires("edit")
async def git_restore(request: Request) -> GitRestoreResponse:
    """
    parameters:
        - in: header
          name: Marimo-Session-Id
          schema:
            type: string
          required: true
    requestBody:
        required: true
        content:
            application/json:
                schema:
                    $ref: "#/components/schemas/GitRestoreRequest"
    responses:
        200:
            description: Restore the notebook to a previous version
            content:
                application/json:
                    schema:
                        $ref: "#/components/schemas/GitRestoreResponse"
    """
    body = await parse_request(request, cls=GitRestoreRequest)
    history, error = _history_for_current_session(request)
    if history is None:
        return GitRestoreResponse(success=False, message=error)

    content = history.show(body.commit_hash)
    if content is None:
        return GitRestoreResponse(
            success=False, message="Could not read that version."
        )

    app_state = AppState(request)
    session = app_state.require_current_session()
    path = session.app_file_manager.path
    assert path is not None  # guaranteed by _history_for_current_session

    # Write the historical content to the real notebook file, then run it
    # through the SAME reload pipeline used when an external editor changes
    # the file on disk: re-parse, diff against the live document, and
    # broadcast/apply the transaction (including autorun, if configured).
    session.app_file_manager.storage.write(Path(path), content)
    try:
        transaction, changed_cell_ids = session.app_file_manager.reload()
    except Exception as e:
        LOGGER.error("Failed to reload after restoring notebook history: %s", e)
        return GitRestoreResponse(
            success=False, message=f"Failed to restore: {e}"
        )

    reload_strategy = create_reload_strategy(
        app_state.mode, session.config_manager
    )
    reload_strategy.handle_reload(
        session, transaction=transaction, changed_cell_ids=changed_cell_ids
    )
    return GitRestoreResponse(success=True)


@router.post("/verify_provider")
@requires("edit")
async def git_verify_provider(request: Request) -> GitVerifyProviderResponse:
    """
    responses:
        200:
            description: Verify the connected GitHub account (app-level config)
            content:
                application/json:
                    schema:
                        $ref: "#/components/schemas/GitVerifyProviderResponse"
    """
    app_state = AppState(request)
    token = get_github_token(
        app_state.config_manager.get_config(hide_secrets=False)
    )
    if not token:
        return GitVerifyProviderResponse(
            success=False, message="No GitHub account connected."
        )
    try:
        username = await GitHubClient(token).whoami()
    except GitProviderError as e:
        return GitVerifyProviderResponse(success=False, message=str(e))
    return GitVerifyProviderResponse(success=True, username=username)


@router.post("/create_remote")
@requires("edit")
async def git_create_remote(request: Request) -> GitCreateRemoteResponse:
    """
    parameters:
        - in: header
          name: Marimo-Session-Id
          schema:
            type: string
          required: true
    requestBody:
        required: true
        content:
            application/json:
                schema:
                    $ref: "#/components/schemas/GitCreateRemoteRequest"
    responses:
        200:
            description: Create a GitHub repo for this notebook and push its history
            content:
                application/json:
                    schema:
                        $ref: "#/components/schemas/GitCreateRemoteResponse"
    """
    body = await parse_request(request, cls=GitCreateRemoteRequest)
    history, error = _history_for_current_session(request)
    if history is None:
        return GitCreateRemoteResponse(success=False, message=error)
    if not history.is_available:
        return GitCreateRemoteResponse(
            success=False, message="git is not installed on this machine."
        )

    app_state = AppState(request)
    token = get_github_token(
        app_state.config_manager.get_config(hide_secrets=False)
    )
    if not token:
        return GitCreateRemoteResponse(
            success=False,
            message="Connect a GitHub account in Settings first.",
        )

    name = body.name.strip()
    if not name:
        return GitCreateRemoteResponse(
            success=False, message="Repo name can't be empty."
        )

    try:
        repo = await GitHubClient(token).create_repo(
            name, private=body.private
        )
    except GitProviderError as e:
        return GitCreateRemoteResponse(success=False, message=str(e))

    history.add_remote(repo.clone_url)

    # Make sure there's at least one commit to push (a brand-new notebook
    # may already have an "Autosave" commit from opening it, but don't rely
    # on that).
    if not history.log():
        session = app_state.require_current_session()
        content = session.app_file_manager.read_file()
        history.commit(content, "Initial commit")

    pushed = history.push(token)
    if not pushed:
        return GitCreateRemoteResponse(
            success=False,
            html_url=repo.html_url,
            message=(
                f"Created {repo.full_name}, but the initial push failed. "
                "Try saving a version again."
            ),
        )
    return GitCreateRemoteResponse(success=True, html_url=repo.html_url)
