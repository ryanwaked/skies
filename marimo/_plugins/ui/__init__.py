# Copyright 2026 Marimo. All rights reserved.
"""Interactive UI elements.

This module contains a library of interactive UI elements.
"""

from __future__ import annotations

import importlib
from typing import TYPE_CHECKING, Any

__all__ = [
    "altair_chart",
    "anywidget",
    "array",
    "batch",
    "button",
    "chat",
    "checkbox",
    "code_editor",
    "data_editor",
    "data_explorer",
    "dataframe",
    "date",
    "date_range",
    "datetime",
    "dictionary",
    "dropdown",
    "experimental_data_editor",
    "file",
    "file_browser",
    "form",
    "matplotlib",
    "matrix",
    "microphone",
    "multiselect",
    "number",
    "panel",
    "plotly",
    "radio",
    "range_slider",
    "refresh",
    "run_button",
    "slider",
    "switch",
    "table",
    "tabs",
    "text",
    "text_area",
]

# Public name -> submodule under `marimo._plugins.ui._impl` that defines it.
#
# UI element implementations are imported lazily (PEP 562) so that
# `import marimo` doesn't eagerly pull in the entire UI subtree (altair,
# dataframes, tables, plotly wrappers, ...). That cost is otherwise paid on
# every CLI invocation and every kernel/session spawn, regardless of which
# elements a given notebook actually uses. Access is uniform (`mo.ui.X`), so
# deferring the import to first use is transparent to callers.
_SUBMODULES: dict[str, str] = {
    "altair_chart": "altair_chart",
    "anywidget": "from_anywidget",
    "array": "array",
    "batch": "batch",
    "button": "input",
    "chat": "chat.chat",
    "checkbox": "input",
    "code_editor": "input",
    "data_editor": "data_editor",
    "data_explorer": "data_explorer",
    "dataframe": "dataframes.dataframe",
    "date": "dates",
    "date_range": "dates",
    "datetime": "dates",
    "dictionary": "dictionary",
    "dropdown": "input",
    "experimental_data_editor": "data_editor",
    "file": "input",
    "file_browser": "file_browser",
    "form": "input",
    "matplotlib": "mpl",
    "matrix": "matrix",
    "microphone": "microphone",
    "multiselect": "input",
    "number": "input",
    "panel": "from_panel",
    "plotly": "plotly",
    "radio": "input",
    "range_slider": "input",
    "refresh": "refresh",
    "run_button": "run_button",
    "slider": "input",
    "switch": "switch",
    "table": "table",
    "tabs": "tabs",
    "text": "input",
    "text_area": "input",
}


def __getattr__(name: str) -> Any:
    """Lazily import UI element implementations on first access (PEP 562)."""
    submodule = _SUBMODULES.get(name)
    if submodule is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    module = importlib.import_module(f"{__name__}._impl.{submodule}")
    value = getattr(module, name)
    # Cache on the module so subsequent accesses skip __getattr__.
    globals()[name] = value
    return value


def __dir__() -> list[str]:
    return sorted(__all__)


if TYPE_CHECKING:
    # Eager imports for static analysis and IDEs only. Keep in sync with
    # `__all__` / `_SUBMODULES` above.
    from marimo._plugins.ui._impl.altair_chart import altair_chart
    from marimo._plugins.ui._impl.array import array
    from marimo._plugins.ui._impl.batch import batch
    from marimo._plugins.ui._impl.chat.chat import chat
    from marimo._plugins.ui._impl.data_editor import (
        data_editor,
        experimental_data_editor,
    )
    from marimo._plugins.ui._impl.data_explorer import data_explorer
    from marimo._plugins.ui._impl.dataframes.dataframe import dataframe
    from marimo._plugins.ui._impl.dates import (
        date,
        date_range,
        datetime,
    )
    from marimo._plugins.ui._impl.dictionary import dictionary
    from marimo._plugins.ui._impl.file_browser import file_browser
    from marimo._plugins.ui._impl.from_anywidget import anywidget
    from marimo._plugins.ui._impl.from_panel import panel
    from marimo._plugins.ui._impl.input import (
        button,
        checkbox,
        code_editor,
        dropdown,
        file,
        form,
        multiselect,
        number,
        radio,
        range_slider,
        slider,
        text,
        text_area,
    )
    from marimo._plugins.ui._impl.matrix import matrix
    from marimo._plugins.ui._impl.microphone import microphone
    from marimo._plugins.ui._impl.mpl import matplotlib
    from marimo._plugins.ui._impl.plotly import plotly
    from marimo._plugins.ui._impl.refresh import refresh
    from marimo._plugins.ui._impl.run_button import run_button
    from marimo._plugins.ui._impl.switch import switch
    from marimo._plugins.ui._impl.table import table
    from marimo._plugins.ui._impl.tabs import tabs
