/* Copyright 2026 Marimo. All rights reserved. */

/**
 * Shared cell-insertion templates: the code marimo pre-fills for each
 * quick-add item. Used by both the between-cells AddCellToolbar and the
 * per-cell create-above/create-below "+" button, so the two entry points
 * offer the same exhaustive set of cell types with identical code.
 */

export const CHART_TEMPLATE = `_chart = (
    alt.Chart(df)  # replace \`df\` with your dataframe
    .mark_bar()
    .encode(
        x="x_column",
        y="y_column",
    )
)
mo.ui.altair_chart(_chart)`;

export const DATAFRAME_TEMPLATE = `# Group, aggregate, and filter interactively
mo.ui.dataframe(df)  # replace \`df\` with your dataframe`;

export const SINGLE_VALUE_TEMPLATE = `mo.stat(
    value=0,
    label="Metric",
    caption="vs. previous period",
    direction="increase",
    bordered=True,
)`;

export const TABLE_TEMPLATE = `mo.ui.table(df, page_size=10)  # replace \`df\` with your dataframe`;

export const SECTION_TEMPLATE = `mo.md(r"""
# New section
""")`;

export const FILTER_TEMPLATE = `_options = sorted(df["column"].unique())  # replace \`df\` and "column"
filter_values = mo.ui.multiselect(options=_options, label="Filter")
filter_values`;

export const INPUT_TEMPLATES: Array<{ label: string; code: string }> = [
  {
    label: "Slider",
    code: 'slider = mo.ui.slider(start=0, stop=100, step=1, label="Slider")\nslider',
  },
  {
    label: "Number",
    code: 'number = mo.ui.number(start=0, stop=100, label="Number")\nnumber',
  },
  {
    label: "Text",
    code: 'text_input = mo.ui.text(placeholder="Enter text", label="Text")\ntext_input',
  },
  {
    label: "Dropdown",
    code: 'dropdown = mo.ui.dropdown(options=["a", "b", "c"], label="Dropdown")\ndropdown',
  },
  {
    label: "Multiselect",
    code: 'multiselect = mo.ui.multiselect(options=["a", "b", "c"], label="Multiselect")\nmultiselect',
  },
  {
    label: "Checkbox",
    code: 'checkbox = mo.ui.checkbox(label="Checkbox")\ncheckbox',
  },
  { label: "Switch", code: 'switch = mo.ui.switch(label="Switch")\nswitch' },
  { label: "Date", code: 'date_input = mo.ui.date(label="Date")\ndate_input' },
  {
    label: "Run button",
    code: 'run_button = mo.ui.run_button(label="Run")\nrun_button',
  },
];
