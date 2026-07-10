# Copyright 2026 Marimo. All rights reserved.
"""Tests for PEP 562 lazy loading of `marimo.ai` (`marimo._ai`)."""

from __future__ import annotations

import pytest

import marimo._ai as ai


def test_all_public_names_resolve_lazily() -> None:
    for name in ai.__all__:
        assert getattr(ai, name) is not None


def test_dir_includes_public_names() -> None:
    assert set(ai.__all__) <= set(dir(ai))


def test_unknown_attribute_raises() -> None:
    with pytest.raises(AttributeError):
        ai.not_a_real_ai_thing  # noqa: B018


def test_lazy_values_match_direct_import() -> None:
    from marimo._ai import llm as llm_direct
    from marimo._ai._types import ChatMessage

    assert ai.llm is llm_direct
    assert ai.ChatMessage is ChatMessage
