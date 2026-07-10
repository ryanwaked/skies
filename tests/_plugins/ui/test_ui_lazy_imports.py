# Copyright 2026 Marimo. All rights reserved.
"""Tests for PEP 562 lazy loading of `marimo.ui` (`marimo._plugins.ui`)."""

from __future__ import annotations

import pytest

from marimo._plugins import ui
from marimo._plugins.ui import _SUBMODULES


def test_submodule_map_matches_all() -> None:
    # Guards against drift: every advertised name must be lazily mappable, and
    # the map must not advertise anything __all__ doesn't.
    assert set(_SUBMODULES) == set(ui.__all__)


def test_all_public_names_resolve_lazily() -> None:
    # Every name in __all__ resolves through __getattr__ without error. The
    # element implementations lazy-import their heavy third-party deps
    # (DependencyManager), so importing the wrapper never requires the dep.
    for name in ui.__all__:
        assert getattr(ui, name) is not None


def test_dir_includes_public_names() -> None:
    assert set(ui.__all__) <= set(dir(ui))


def test_unknown_attribute_raises() -> None:
    with pytest.raises(AttributeError):
        ui.definitely_not_a_real_element  # noqa: B018


def test_lazy_value_matches_direct_import() -> None:
    from marimo._plugins.ui._impl.input import slider
    from marimo._plugins.ui._impl.table import table

    assert ui.slider is slider
    assert ui.table is table


def test_accessed_name_is_cached_on_module() -> None:
    # First access caches the value in the module namespace so subsequent
    # lookups skip __getattr__.
    _ = ui.button
    assert "button" in vars(ui)
