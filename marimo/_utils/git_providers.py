# Copyright 2026 Marimo. All rights reserved.
"""Minimal git-hosting-provider clients for the notebook version history
feature: verify a connected account and create a repository to push
saved versions to.

Only GitHub is implemented today; the small `GitHubClient` surface (whoami /
create_repo) is deliberately narrow so a self-hosted provider (Gitea, GitLab
CE, etc.) can be added later as a sibling class without reshaping callers.
"""

from __future__ import annotations

import dataclasses
from typing import TYPE_CHECKING, Any

import httpx

if TYPE_CHECKING:
    from marimo._config.config import MarimoConfig

GITHUB_API_BASE = "https://api.github.com"
_TIMEOUT_SECONDS = 15.0


class GitProviderError(Exception):
    """Raised when a git provider API call fails."""


@dataclasses.dataclass(frozen=True)
class GitHubRepo:
    full_name: str
    html_url: str
    clone_url: str


class GitHubClient:
    """Thin async wrapper over the subset of the GitHub REST API needed to
    verify an account and create a repository."""

    def __init__(self, token: str, *, base_url: str = GITHUB_API_BASE) -> None:
        self.token = token
        self.base_url = base_url

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def whoami(self) -> str:
        """Verify the token and return the authenticated username."""
        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            response = await client.get(
                f"{self.base_url}/user", headers=self._headers()
            )
        if response.status_code != 200:
            raise GitProviderError(_error_message(response))
        return str(response.json()["login"])

    async def create_repo(
        self,
        name: str,
        *,
        private: bool = True,
        description: str | None = None,
    ) -> GitHubRepo:
        """Create a new (empty) repository under the authenticated account."""
        body: dict[str, Any] = {
            "name": name,
            "private": private,
            # We push our own initial commit; an auto-initialized repo would
            # have a conflicting root commit (GitHub's README/.gitignore).
            "auto_init": False,
        }
        if description:
            body["description"] = description

        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            response = await client.post(
                f"{self.base_url}/user/repos",
                headers=self._headers(),
                json=body,
            )
        if response.status_code != 201:
            raise GitProviderError(_error_message(response))

        data = response.json()
        return GitHubRepo(
            full_name=data["full_name"],
            html_url=data["html_url"],
            clone_url=data["clone_url"],
        )


def _error_message(response: httpx.Response) -> str:
    try:
        data = response.json()
        message = data.get("message", response.text)
    except ValueError:
        message = response.text
    return f"GitHub API error ({response.status_code}): {message}"


def get_github_token(config: MarimoConfig) -> str | None:
    """Read the connected GitHub token out of a resolved app config.

    This is server-side (Starlette request handler) config, via
    `AppState.config_manager.get_config(hide_secrets=False)` — NOT the
    kernel-side `get_context()` runtime context, which only exists while
    code is executing inside a notebook's kernel process.
    """
    return (
        config.get("version_control", {})  # type: ignore[typeddict-item]
        .get("github", {})
        .get("token")
    )
