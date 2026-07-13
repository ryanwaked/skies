# Copyright 2026 Marimo. All rights reserved.
"""Request/response models for the remote-compute (SSH) feature."""

from __future__ import annotations

import msgspec

from marimo._server.models.models import BaseResponse


class VerifyRemoteComputeTargetRequest(msgspec.Struct, rename="camel"):
    ssh_destination: str


class VerifyRemoteComputeTargetResponse(BaseResponse):
    message: str | None = None


class SetRemoteComputeTargetRequest(msgspec.Struct, rename="camel"):
    # Name of a configured target to run this notebook's kernel on, or
    # None/omitted to switch back to running locally.
    target_name: str | None = None


class SetRemoteComputeTargetResponse(BaseResponse):
    message: str | None = None
