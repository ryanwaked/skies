# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

from starlette.authentication import requires

from marimo import _loggers
from marimo._server.api.deps import AppState
from marimo._server.api.endpoints.ws.ws_connection_validator import (
    FILE_QUERY_PARAM_KEY,
)
from marimo._server.api.endpoints.ws_endpoint import DOC_MANAGER
from marimo._server.api.utils import parse_request
from marimo._server.models.remote_compute import (
    SetRemoteComputeTargetRequest,
    SetRemoteComputeTargetResponse,
    VerifyRemoteComputeTargetRequest,
    VerifyRemoteComputeTargetResponse,
)
from marimo._server.router import APIRouter
from marimo._server.workspace import MarimoFileKey
from marimo._session.managers.ssh import RemoteComputeTarget

if TYPE_CHECKING:
    from starlette.requests import Request

LOGGER = _loggers.marimo_logger()

# Router for the remote-compute (SSH) endpoints
router = APIRouter()

_VERIFY_TIMEOUT_SECONDS = 10.0


@router.post("/verify_target")
@requires("edit")
async def verify_remote_compute_target(
    request: Request,
) -> VerifyRemoteComputeTargetResponse:
    """
    requestBody:
        required: true
        content:
            application/json:
                schema:
                    $ref: "#/components/schemas/VerifyRemoteComputeTargetRequest"
    responses:
        200:
            description: Check that an SSH destination is reachable
            content:
                application/json:
                    schema:
                        $ref: "#/components/schemas/VerifyRemoteComputeTargetResponse"
    """
    body = await parse_request(request, cls=VerifyRemoteComputeTargetRequest)
    destination = body.ssh_destination.strip()
    if not destination:
        return VerifyRemoteComputeTargetResponse(
            success=False, message="Enter an SSH destination."
        )

    try:
        proc = await asyncio.create_subprocess_exec(
            "ssh",
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=10",
            destination,
            "true",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError:
        return VerifyRemoteComputeTargetResponse(
            success=False, message="ssh is not installed on this machine."
        )

    try:
        _, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=_VERIFY_TIMEOUT_SECONDS
        )
    except TimeoutError:
        proc.kill()
        return VerifyRemoteComputeTargetResponse(
            success=False, message=f"Timed out connecting to {destination!r}."
        )

    if proc.returncode != 0:
        return VerifyRemoteComputeTargetResponse(
            success=False,
            message=stderr.decode().strip() or "Could not connect over SSH.",
        )
    return VerifyRemoteComputeTargetResponse(success=True)


def _find_target(
    request: Request, target_name: str
) -> RemoteComputeTarget | None:
    config = AppState(request).config_manager.get_config(hide_secrets=False)
    targets = config.get("remote_compute", {}).get("targets", [])
    for target_config in targets:
        if target_config["name"] == target_name:
            return RemoteComputeTarget.from_config(target_config)
    return None


@router.post("/set_target")
@requires("edit")
async def set_remote_compute_target(
    request: Request,
) -> SetRemoteComputeTargetResponse:
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
                    $ref: "#/components/schemas/SetRemoteComputeTargetRequest"
    responses:
        200:
            description: >
                Set (or clear) the remote-compute target this notebook's
                kernel should run on, restarting its session so the change
                takes effect.
            content:
                application/json:
                    schema:
                        $ref: "#/components/schemas/SetRemoteComputeTargetResponse"
    """
    body = await parse_request(request, cls=SetRemoteComputeTargetRequest)
    app_state = AppState(request)
    session_manager = app_state.session_manager
    session_id = app_state.require_current_session_id()
    session = app_state.require_current_session()

    file_key: MarimoFileKey | None = (
        app_state.query_params(FILE_QUERY_PARAM_KEY)
        or session_manager.workspace.get_unique_file_key()
        or session.app_file_manager.path
    )
    if file_key is None:
        return SetRemoteComputeTargetResponse(
            success=False,
            message="Save this notebook before choosing where it runs.",
        )

    target: RemoteComputeTarget | None = None
    if body.target_name:
        target = _find_target(request, body.target_name)
        if target is None:
            return SetRemoteComputeTargetResponse(
                success=False,
                message=f"No remote-compute target named {body.target_name!r}.",
            )

    session_manager.set_remote_compute_target(file_key, target)

    # Same "close and let the frontend reconnect" pattern as
    # /api/kernel/restart_session; create_session() picks up the new
    # override the next time this file's session is (re)created.
    session_manager.close_session(session_id)
    await DOC_MANAGER.remove_doc(file_key)

    return SetRemoteComputeTargetResponse(success=True)
