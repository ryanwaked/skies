# Copyright 2026 Marimo. All rights reserved.
"""Tests for the home-page notebook-preview builder and helpers."""

from __future__ import annotations

import textwrap
from typing import TYPE_CHECKING

from marimo._server.api.endpoints.home import (
    _build_notebook_preview,
    _classify_cell,
    _first_heading,
    _visual_hint,
)

if TYPE_CHECKING:
    from pathlib import Path

NOTEBOOK = textwrap.dedent(
    '''
    import marimo

    app = marimo.App()


    @app.cell
    def _():
        import marimo as mo
        return (mo,)


    @app.cell
    def _(mo):
        mo.md("""# My Title

        Some introductory body text.""")
        return


    @app.cell
    def _(mo):
        _df = mo.sql("SELECT 1 AS x")
        return


    @app.cell
    def _():
        import pandas as pd

        pd.DataFrame({"a": [1, 2, 3]})
        return


    if __name__ == "__main__":
        app.run()
    '''
)


def _write(tmp_path: Path, contents: str, name: str = "nb.py") -> str:
    path = tmp_path / name
    path.write_text(contents, encoding="utf-8")
    return str(path)


def test_build_notebook_preview(tmp_path: Path) -> None:
    preview = _build_notebook_preview(_write(tmp_path, NOTEBOOK))

    assert preview.title == "My Title"
    assert preview.total_cells == 4

    types = [cell.cell_type for cell in preview.cells]
    assert types == ["python", "markdown", "sql", "python"]

    # The import cell renders as a code silhouette.
    assert preview.cells[0].lines
    assert preview.cells[0].markdown is None

    # The markdown cell keeps its rendered text and no source lines.
    assert preview.cells[1].markdown is not None
    assert "My Title" in preview.cells[1].markdown
    assert preview.cells[1].lines == []

    # SQL and dataframe cells hint at a table output.
    assert preview.cells[2].cell_type == "sql"
    assert preview.cells[2].visual == "table"
    assert preview.cells[3].visual == "table"


def test_build_notebook_preview_caps_cells(tmp_path: Path) -> None:
    cells = "\n\n".join(
        f'@app.cell\ndef _(mo):\n    mo.md("cell {i}")\n    return'
        for i in range(20)
    )
    contents = f"import marimo\n\napp = marimo.App()\n\n{cells}\n"
    preview = _build_notebook_preview(_write(tmp_path, contents))
    # Only the first handful of cells are returned, but the true count stands.
    assert len(preview.cells) <= 6
    assert preview.total_cells == 20


def test_build_notebook_preview_missing_file(tmp_path: Path) -> None:
    preview = _build_notebook_preview(str(tmp_path / "does_not_exist.py"))
    assert preview.title is None
    assert preview.cells == []
    assert preview.total_cells == 0


def test_build_notebook_preview_non_marimo_file(tmp_path: Path) -> None:
    preview = _build_notebook_preview(
        _write(tmp_path, "print('hello, not a notebook')\n")
    )
    assert preview.cells == []


def test_visual_hint() -> None:
    assert _visual_hint("_df = mo.sql('...')", "sql") == "table"
    assert _visual_hint("alt.Chart(df).mark_bar()", "python") == "chart"
    assert _visual_hint("import plotly.express as px", "python") == "chart"
    assert _visual_hint("mo.ui.table(df)", "python") == "table"
    assert _visual_hint("slider = mo.ui.slider(1, 10)", "python") == "widget"
    assert _visual_hint("df = pd.DataFrame({})", "python") == "table"
    assert _visual_hint("x = 1 + 1", "python") == "none"


def test_classify_cell() -> None:
    kind, markdown, lines = _classify_cell('mo.md("# Heading")')
    assert kind == "markdown"
    assert markdown == "# Heading"
    assert lines == []

    kind, markdown, lines = _classify_cell("df = mo.sql('SELECT 1')")
    assert kind == "sql"
    assert markdown is None

    kind, markdown, lines = _classify_cell("x = 1\n\ny = 2\n")
    assert kind == "python"
    assert lines == ["x = 1", "y = 2"]  # blank lines dropped


def test_first_heading() -> None:
    assert _first_heading("# Title\nbody") == "Title"
    assert _first_heading("## Sub") == "Sub"
    assert _first_heading("just body text") is None
    assert _first_heading("") is None
