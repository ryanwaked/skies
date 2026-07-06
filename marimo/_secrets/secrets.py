# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

from typing import TYPE_CHECKING

from marimo import _loggers
from marimo._config.config import MarimoConfig
from marimo._secrets.env_provider import (
    DotEnvSecretsProvider,
    EnvSecretsProvider,
)
from marimo._secrets.models import SecretKeysWithProvider, SecretProvider
from marimo._utils.xdg import marimo_wide_dotenv_path

LOGGER = _loggers.marimo_logger()

# Display name for the user-level dotenv (secrets shared across all
# notebooks). Kept distinct from any project `.env` basename.
MARIMO_WIDE_LABEL = "Marimo-wide"

if TYPE_CHECKING:
    from marimo._server.models.secrets import CreateSecretRequest


def _get_providers(
    config: MarimoConfig, original_environ: dict[str, str]
) -> list[SecretProvider]:
    providers: list[SecretProvider] = [EnvSecretsProvider(original_environ)]

    # Add project-scoped dotenv providers (from `runtime.dotenv`).
    dotenvs: list[str] = config.get("runtime", {}).get("dotenv", [])
    if dotenvs and isinstance(dotenvs, list):
        providers.extend(DotEnvSecretsProvider(dotenv) for dotenv in dotenvs)

    # Always offer the marimo-wide dotenv, so a secret can be scoped to the
    # current project (a `.env`) or to every notebook (this user-level file).
    providers.append(
        DotEnvSecretsProvider(
            str(marimo_wide_dotenv_path()), label=MARIMO_WIDE_LABEL
        )
    )

    return providers


def get_secret_keys(
    config: MarimoConfig, original_environ: dict[str, str]
) -> list[SecretKeysWithProvider]:
    providers: list[SecretProvider] = _get_providers(config, original_environ)
    results: list[SecretKeysWithProvider] = []
    seen_keys: set[str] = set()
    for provider in providers:
        keys = provider.get_keys()
        results.append(
            SecretKeysWithProvider(
                # We remove duplicates by only adding keys that haven't been
                # seen yet.
                # This is because we don't override existing keys in the
                # environment.
                provider=provider.type,
                name=provider.name,
                keys=sorted(keys - seen_keys),
            )
        )
        seen_keys.update(keys)

    return results


def write_secret(request: CreateSecretRequest, config: MarimoConfig) -> None:
    # original_environ is not used for anything in the write operation
    providers = _get_providers(config, {})
    for provider in providers:
        if provider.type == request.provider and provider.name == request.name:
            provider.write_key(request.key, request.value)
            return
    LOGGER.error(
        f"Can't find provider {request.provider} with name {request.name}. Possible providers: {[f'{p.name} ({p.type})' for p in providers]}"
    )
    raise ValueError(
        f"Can't find provider {request.provider} with name {request.name}"
    )
