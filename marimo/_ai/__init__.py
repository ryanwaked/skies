# Copyright 2026 Marimo. All rights reserved.
"""AI utilities."""

from __future__ import annotations

import importlib
from typing import TYPE_CHECKING, Any

__all__ = [
    "ChatAttachment",
    "ChatMessage",
    "ChatModelConfig",
    "llm",
]

# The Chat* types live in `marimo._ai._types`; `llm` is a subpackage. Both are
# imported lazily (PEP 562) so `import marimo` doesn't pull in the AI stack
# unless it's actually used. Access is uniform (`mo.ai.X`), so this is
# transparent to callers.
_TYPE_NAMES = frozenset({"ChatAttachment", "ChatMessage", "ChatModelConfig"})


def __getattr__(name: str) -> Any:
    """Lazily import AI utilities on first access (PEP 562)."""
    if name == "llm":
        module = importlib.import_module(f"{__name__}.llm")
        globals()["llm"] = module
        return module
    if name in _TYPE_NAMES:
        types_module = importlib.import_module(f"{__name__}._types")
        value = getattr(types_module, name)
        globals()[name] = value
        return value
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted(__all__)


if TYPE_CHECKING:
    # Eager imports for static analysis and IDEs only.
    from marimo._ai import llm
    from marimo._ai._types import (
        ChatAttachment,
        ChatMessage,
        ChatModelConfig,
    )
