/* Copyright 2026 Marimo. All rights reserved. */

import type { TopLevelSpec } from "vega-lite";
import type {
  ColorDef,
  Field,
  PolarDef,
  PositionDef,
} from "vega-lite/types_unstable/channeldef.js";
import type { Encoding } from "vega-lite/types_unstable/encoding.js";
import type { Resolve } from "vega-lite/types_unstable/resolve.js";
import type { FacetFieldDef } from "vega-lite/types_unstable/spec/facet.js";
import type { Transform } from "vega-lite/types_unstable/transform.js";
import type { z } from "zod";
import type { ResolvedTheme } from "@/theme/useTheme";
import type { TypedString } from "@/utils/typed";
import {
  COUNT_FIELD,
  DEFAULT_AGGREGATION,
  DEFAULT_MAX_BINS_FACET,
  DEFAULT_TIME_UNIT,
  EMPTY_VALUE,
  MULTI_SERIES_CHART_TYPES,
  SERIES_FIELD,
  SERIES_VALUE_FIELD,
} from "../constants";
import type {
  AxisSchema,
  AxisStyleSchemaType,
  BinSchema,
  ChartSchemaType,
  ColumnFacet,
  RowFacet,
} from "../schemas";
import { ChartType, type ValidAggregationFn } from "../types";
import {
  getAggregate,
  getAxisFormat,
  getAxisScale,
  getBinEncoding,
  getColorEncoding,
  getColorInScale,
  getLegendEncoding,
  getOffsetEncoding,
} from "./encodings";
import { getTooltips } from "./tooltips";
import {
  type BaseSpec,
  convertChartTypeToMark,
  convertDataTypeToVega,
} from "./types";
import { escapeFieldName } from "./utils";

/**
 * Convert marimo chart configuration to Vega-Lite specification.
 */

export type ErrorMessage = TypedString<"ErrorMessage">;
export const X_AXIS_REQUIRED = "X-axis column is required" as ErrorMessage;
export const Y_AXIS_REQUIRED = "Y-axis column is required" as ErrorMessage;

export function createSpecWithoutData(
  chartType: ChartType,
  formValues: ChartSchemaType,
  theme: ResolvedTheme,
  width: number | "container",
  height: number,
): TopLevelSpec | ErrorMessage {
  const { xColumn, colorByColumn, horizontal, stacking, title, facet } =
    formValues.general ?? {};

  if (chartType === ChartType.PIE) {
    return getPieChartSpec(formValues, theme, width, height);
  }

  // Validate required fields
  if (!isFieldSet(xColumn?.field)) {
    return X_AXIS_REQUIRED;
  }
  const yColumns = getYSeriesColumns(formValues);
  if (yColumns.length === 0) {
    return Y_AXIS_REQUIRED;
  }

  const yColumn = yColumns[0];
  const isMultiSeries =
    yColumns.length > 1 && MULTI_SERIES_CHART_TYPES.includes(chartType);

  // When multiple series are set, they are folded into a single "value"
  // column and colored by "series", so the explicit color-by column is
  // ignored.
  const hasColor = isMultiSeries || Boolean(colorByColumn?.field);

  // Determine encoding keys based on chart type
  const xEncodingKey = "x";
  const yEncodingKey = "y";

  // Create encodings
  const xEncoding = getAxisEncoding(
    xColumn,
    formValues.xAxis?.bin,
    getFieldLabel(formValues.xAxis?.label),
    hasColor && horizontal ? stacking : undefined,
    chartType,
    undefined,
    formValues.xAxis,
  );

  let defaultYAggregation: ValidAggregationFn = DEFAULT_AGGREGATION;
  if (yColumn.selectedDataType === "string") {
    defaultYAggregation = "count";
  }

  const yEncoding = isMultiSeries
    ? getFoldedYEncoding(
        formValues,
        yColumn,
        hasColor && !horizontal ? stacking : undefined,
      )
    : getAxisEncoding(
        yColumn,
        formValues.yAxis?.bin,
        getFieldLabel(formValues.yAxis?.label),
        hasColor && !horizontal ? stacking : undefined,
        chartType,
        defaultYAggregation,
        formValues.yAxis,
      );

  const rowFacet = facet?.row.field
    ? getFacetEncoding(facet.row, chartType)
    : undefined;
  const columnFacet = facet?.column.field
    ? getFacetEncoding(facet.column, chartType)
    : undefined;

  const colorByEncoding: ColorDef<string> | undefined = isMultiSeries
    ? {
        field: SERIES_FIELD,
        type: "nominal",
        scale: getColorInScale(formValues),
        legend: getLegendEncoding(formValues),
      }
    : getColorEncoding(chartType, formValues);
  const baseSpec = getBaseSpec(
    chartType,
    formValues,
    theme,
    width,
    height,
    title,
  );
  const baseEncoding: Encoding<Field> = {
    [xEncodingKey]: horizontal ? yEncoding : xEncoding,
    [yEncodingKey]: horizontal ? xEncoding : yEncoding,
    xOffset: isMultiSeries
      ? chartType === ChartType.BAR && !stacking
        ? { field: SERIES_FIELD }
        : undefined
      : getOffsetEncoding(chartType, formValues),
    color: colorByEncoding,
    tooltip: getTooltips({
      formValues,
      xEncoding,
      yEncoding,
      colorByEncoding,
    }),
    ...(rowFacet && { row: rowFacet }),
    ...(columnFacet && { column: columnFacet }),
  };
  const resolve = getResolve(facet?.column, facet?.row);

  // Multiple Y series are folded into (series, value) pairs so that a
  // single mark definition renders one line/bar/point group per series.
  const transform: Transform[] | undefined = isMultiSeries
    ? [
        {
          fold: yColumns.map((column) => escapeFieldName(column.field) ?? ""),
          as: [SERIES_FIELD, SERIES_VALUE_FIELD],
        },
      ]
    : undefined;

  // Create the final spec for other chart types
  return {
    ...baseSpec,
    ...(transform && { transform }),
    mark: { type: convertChartTypeToMark(chartType) },
    encoding: baseEncoding,
    ...resolve,
  };
}

/**
 * Resolves the full list of Y series columns.
 * `general.yColumn` is the first series (kept for backwards compatibility
 * with configs saved before multi-series support); `general.yColumns` holds
 * any additional series.
 */
export function getYSeriesColumns(
  formValues: ChartSchemaType,
): z.infer<typeof AxisSchema>[] {
  const general = formValues.general;
  const columns = [general?.yColumn, ...(general?.yColumns ?? [])];
  return columns.filter(
    (column): column is z.infer<typeof AxisSchema> =>
      column !== undefined && isFieldSet(column.field),
  );
}

/**
 * Y encoding for multi-series charts: values from all series are folded
 * into a single "value" field. The first series' aggregation is shared
 * across all series.
 */
function getFoldedYEncoding(
  formValues: ChartSchemaType,
  firstSeries: z.infer<typeof AxisSchema>,
  stack: boolean | undefined,
): PositionDef<string> {
  return {
    field: SERIES_VALUE_FIELD,
    type: "quantitative",
    title: getFieldLabel(formValues.yAxis?.label),
    stack: stack,
    aggregate: getAggregate(
      firstSeries.aggregate,
      "number",
      DEFAULT_AGGREGATION,
    ),
    scale: getAxisScale(formValues.yAxis),
    axis: getAxisFormat(formValues.yAxis),
  };
}

export function augmentSpecWithData(
  spec: TopLevelSpec,
  data: object[],
): TopLevelSpec {
  return {
    ...spec,
    data: { values: data },
  };
}

export function getAxisEncoding(
  column: NonNullable<z.infer<typeof AxisSchema>>,
  binValues: z.infer<typeof BinSchema> | undefined,
  label: string | undefined,
  stack: boolean | undefined,
  chartType: ChartType,
  defaultAggregate?: ValidAggregationFn,
  axisStyles?: AxisStyleSchemaType,
): PositionDef<string> {
  const selectedDataType = column.selectedDataType || "string";
  const axis = getAxisFormat(axisStyles);

  if (column.field === COUNT_FIELD) {
    return {
      aggregate: "count",
      type: "quantitative",
      bin: getBinEncoding(chartType, selectedDataType, binValues),
      title: label === COUNT_FIELD ? undefined : label,
      stack: stack,
      scale: getAxisScale(axisStyles),
      axis: axis,
    };
  }

  const vegaType = convertDataTypeToVega(column.selectedDataType || "unknown");

  return {
    field: escapeFieldName(column.field),
    type: vegaType,
    bin: getBinEncoding(chartType, selectedDataType, binValues),
    title: label,
    stack: stack,
    aggregate: getAggregate(
      column.aggregate,
      selectedDataType,
      defaultAggregate,
    ),
    sort: column.sort,
    timeUnit: getTimeUnit(column),
    // Scale type and domain overrides only apply to continuous numeric axes
    scale: vegaType === "quantitative" ? getAxisScale(axisStyles) : undefined,
    axis: axis,
  };
}

export function getFacetEncoding(
  facet: z.infer<typeof RowFacet> | z.infer<typeof ColumnFacet>,
  chartType: ChartType,
): FacetFieldDef<Field> {
  const defaultBinValues = {
    maxbins: DEFAULT_MAX_BINS_FACET,
  };
  const binValues = getBinEncoding(
    chartType,
    facet.selectedDataType || "string",
    {
      maxbins: facet.maxbins,
      binned: facet.binned,
    },
    defaultBinValues,
  );

  return {
    field: escapeFieldName(facet.field),
    sort: facet.sort,
    timeUnit: getFacetTimeUnit(facet),
    type: convertDataTypeToVega(facet.selectedDataType || "unknown"),
    bin: binValues,
  };
}

function getPieChartSpec(
  formValues: ChartSchemaType,
  theme: ResolvedTheme,
  width: number | "container",
  height: number,
): TopLevelSpec | ErrorMessage {
  const { yColumn, colorByColumn, title } = formValues.general ?? {};

  if (!isFieldSet(colorByColumn?.field)) {
    return "Color by column is required" as ErrorMessage;
  }

  if (!isFieldSet(yColumn?.field)) {
    return "Size by column is required" as ErrorMessage;
  }

  const thetaEncoding: PolarDef<string> = getAxisEncoding(
    yColumn,
    formValues.xAxis?.bin,
    getFieldLabel(formValues.xAxis?.label),
    undefined,
    ChartType.PIE,
  );

  const colorEncoding: ColorDef<string> = {
    field: escapeFieldName(colorByColumn.field),
    type: convertDataTypeToVega(colorByColumn.selectedDataType || "unknown"),
    scale: getColorInScale(formValues),
    title: getFieldLabel(formValues.yAxis?.label),
    legend: getLegendEncoding(formValues),
  };

  return {
    ...getBaseSpec(ChartType.PIE, formValues, theme, width, height, title),
    mark: {
      type: convertChartTypeToMark(ChartType.PIE),
      innerRadius: formValues.style?.innerRadius,
    },
    encoding: {
      theta: thetaEncoding,
      color: colorEncoding,
      tooltip: getTooltips({
        formValues,
        xEncoding: thetaEncoding,
        yEncoding: thetaEncoding,
        colorByEncoding: colorEncoding,
      }),
    },
  };
}

/**
 * The chart title. Kept as a plain string unless the user customized its size
 * or weight, in which case it becomes a vega-lite title object so the exported
 * altair code and the preview stay minimal in the common case.
 */
function buildTitle(
  title: string | undefined,
  formValues: ChartSchemaType,
): string | { text: string; fontSize?: number; fontWeight?: "bold" } | undefined {
  if (!title) {
    return undefined;
  }
  const fontSize = formValues.general?.titleFontSize;
  const bold = formValues.general?.titleBold;
  if (fontSize == null && !bold) {
    return title;
  }
  return {
    text: title,
    ...(fontSize != null && { fontSize }),
    ...(bold && { fontWeight: "bold" as const }),
  };
}

function getBaseSpec(
  chartType: ChartType,
  formValues: ChartSchemaType,
  theme: ResolvedTheme,
  width: number | "container",
  height: number,
  title?: string,
): BaseSpec {
  let gridLines = formValues.style?.gridLines ?? false;
  // Scatter charts have grid lines by default
  if (chartType === ChartType.SCATTER) {
    gridLines = true;
  }

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    // Transparent in both modes: charts sit directly on the Skies
    // paper/canvas surface (the shared getSkiesVegaConfig owns colors).
    background: "transparent",
    title: buildTitle(title, formValues),
    data: { values: [] },
    height: formValues.yAxis?.height ?? height,
    width: formValues.xAxis?.width ?? width,
    config: {
      axis: {
        grid: gridLines,
      },
    },
  };
}

export function isFieldSet(field: string | undefined): field is string {
  return field !== undefined && field.trim() !== EMPTY_VALUE;
}

// Returns undefined if the label is empty, as Vega-Lite will use the proper name
function getFieldLabel(label?: string): string | undefined {
  const trimmedLabel = label?.trim();
  return trimmedLabel === EMPTY_VALUE ? undefined : trimmedLabel;
}

function getTimeUnit(column: z.infer<typeof AxisSchema>) {
  if (column.selectedDataType === "temporal") {
    return column.timeUnit ?? DEFAULT_TIME_UNIT;
  }
  return undefined;
}

function getFacetTimeUnit(
  facet: z.infer<typeof RowFacet> | z.infer<typeof ColumnFacet>,
) {
  if (facet.selectedDataType === "temporal") {
    return facet.timeUnit ?? DEFAULT_TIME_UNIT;
  }
  return undefined;
}

function getResolve(
  columnFacet?: z.infer<typeof ColumnFacet>,
  rowFacet?: z.infer<typeof RowFacet>,
): { resolve: Resolve } | undefined {
  const resolveAxis: Resolve["axis"] = {};

  if (columnFacet?.linkXAxis === false) {
    resolveAxis.x = "independent";
  }

  if (rowFacet?.linkYAxis === false) {
    resolveAxis.y = "independent";
  }

  // If no independent axes, return undefined (shared)
  return Object.keys(resolveAxis).length > 0
    ? { resolve: { axis: resolveAxis } }
    : undefined;
}
