/* Copyright 2026 Marimo. All rights reserved. */

import type { Aggregate } from "vega-lite/types_unstable/aggregate.js";
import type { BinParams } from "vega-lite/types_unstable/bin.js";
import type {
  ColorDef,
  OffsetDef,
} from "vega-lite/types_unstable/channeldef.js";
import type { Scale } from "vega-lite/types_unstable/scale.js";
import type { ColorScheme } from "vega-typings";
import type { z } from "zod";
import {
  COUNT_FIELD,
  DEFAULT_AXIS_SCALE,
  DEFAULT_COLOR_SCHEME,
  DEFAULT_LEGEND_POSITION,
} from "../constants";
import type {
  AxisSchema,
  AxisStyleSchemaType,
  BinSchema,
  ChartSchemaType,
} from "../schemas";
import {
  type AggregationFn,
  BIN_AGGREGATION,
  ChartType,
  NONE_VALUE,
  type SelectableDataType,
  STRING_AGGREGATION_FNS,
  type ValidAggregationFn,
} from "../types";
import { isFieldSet } from "./spec";
import { convertDataTypeToVega } from "./types";
import { escapeFieldName } from "./utils";

export function getBinEncoding(
  chartType: ChartType,
  selectedDataType: SelectableDataType,
  binValues?: z.infer<typeof BinSchema>,
  defaultBinValues?: z.infer<typeof BinSchema>,
): boolean | BinParams | undefined {
  if (chartType === ChartType.HEATMAP) {
    if (!binValues?.maxbins) {
      return undefined;
    }
    return { maxbins: binValues?.maxbins };
  }

  // Don't bin non-numeric data
  if (selectedDataType !== "number") {
    return undefined;
  }

  if (!binValues?.binned) {
    return defaultBinValues;
  }

  const binParams: BinParams = {};
  if (binValues.step !== undefined) {
    binParams.step = binValues.step;
  }
  if (binValues.maxbins !== undefined) {
    binParams.maxbins = binValues.maxbins;
  }

  if (Object.keys(binParams).length === 0) {
    return true;
  }

  return binParams;
}

function isSetNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Builds the vega-lite scale (type and domain) for an axis.
 * Returns undefined when everything is at its default.
 */
export function getAxisScale(
  axisStyles: AxisStyleSchemaType | undefined,
): Scale | undefined {
  if (!axisStyles) {
    return undefined;
  }

  const type =
    axisStyles.scale && axisStyles.scale !== DEFAULT_AXIS_SCALE
      ? axisStyles.scale
      : undefined;

  let domainMin = isSetNumber(axisStyles.domainMin)
    ? axisStyles.domainMin
    : undefined;
  let domainMax = isSetNumber(axisStyles.domainMax)
    ? axisStyles.domainMax
    : undefined;

  // A log scale cannot contain zero or negative values;
  // omit the domain instead of erroring.
  if (type === "log" && domainMin !== undefined && domainMin <= 0) {
    domainMin = undefined;
    domainMax = undefined;
  }

  const scale: Scale = {};
  if (type) {
    scale.type = type;
  }
  if (domainMin !== undefined && domainMax !== undefined) {
    scale.domain = [domainMin, domainMax];
  } else if (domainMin !== undefined) {
    scale.domainMin = domainMin;
  } else if (domainMax !== undefined) {
    scale.domainMax = domainMax;
  }

  return Object.keys(scale).length > 0 ? scale : undefined;
}

/**
 * Builds the vega-lite axis definition (currently just the d3 number format).
 */
export function getAxisFormat(
  axisStyles: AxisStyleSchemaType | undefined,
): { format: string } | undefined {
  const format = axisStyles?.format?.trim();
  return format ? { format } : undefined;
}

/**
 * Builds the legend definition for the color encoding.
 * `null` hides the legend; undefined keeps the vega-lite default (right).
 */
export function getLegendEncoding(
  formValues: ChartSchemaType,
): { orient: "bottom" } | null | undefined {
  const legend = formValues.color?.legend ?? DEFAULT_LEGEND_POSITION;
  if (legend === "none") {
    return null;
  }
  if (legend === "bottom") {
    return { orient: "bottom" };
  }
  // "right" is the vega-lite default
  return undefined;
}

export function getColorInScale(
  formValues: ChartSchemaType,
): Scale | undefined {
  const colorRange = formValues.color?.range;
  if (colorRange?.length) {
    return { range: colorRange };
  }

  const scheme = formValues.color?.scheme;
  if (scheme && scheme !== DEFAULT_COLOR_SCHEME) {
    return { scheme: scheme as ColorScheme };
  }
}

export function getColorEncoding(
  chartType: ChartType,
  formValues: ChartSchemaType,
): ColorDef<string> | undefined {
  if (chartType === ChartType.PIE) {
    return undefined;
  }

  // Choose colorByColumn if it's set, otherwise use color.field
  // Color.field can be used to set colour scheme of the charts
  let colorByColumn: z.infer<typeof AxisSchema> | undefined;
  if (isFieldSet(formValues.general?.colorByColumn?.field)) {
    colorByColumn = formValues.general?.colorByColumn;
  } else if (isFieldSet(formValues.color?.field)) {
    const field = formValues.color?.field;
    switch (field) {
      case "X":
        colorByColumn = formValues.general?.xColumn;
        break;
      case "Y":
        colorByColumn = formValues.general?.yColumn;
        break;
      case "Color":
        colorByColumn = formValues.general?.colorByColumn;
        break;
      default:
        return undefined;
    }
  } else {
    return undefined;
  }

  if (
    !colorByColumn ||
    !isFieldSet(colorByColumn.field) ||
    colorByColumn.field === NONE_VALUE
  ) {
    return undefined;
  }

  if (colorByColumn.field === COUNT_FIELD) {
    return {
      aggregate: "count",
      type: "quantitative",
      legend: getLegendEncoding(formValues),
    };
  }

  const colorBin = formValues.color?.bin;
  const selectedDataType = colorByColumn.selectedDataType || "string";
  const aggregate = colorByColumn?.aggregate;

  return {
    field: escapeFieldName(colorByColumn.field),
    type: convertDataTypeToVega(selectedDataType),
    scale: getColorInScale(formValues),
    aggregate: getAggregate(aggregate, selectedDataType),
    bin: getBinEncoding(chartType, selectedDataType, colorBin),
    legend: getLegendEncoding(formValues),
  };
}

export function getOffsetEncoding(
  chartType: ChartType,
  formValues: ChartSchemaType,
): OffsetDef<string> | undefined {
  // Offset only applies to bar charts, to unstack them
  if (
    formValues.general?.stacking ||
    !isFieldSet(formValues.general?.colorByColumn?.field) ||
    chartType !== ChartType.BAR
  ) {
    return undefined;
  }
  return { field: escapeFieldName(formValues.general?.colorByColumn?.field) };
}

export function getAggregate(
  aggregate: AggregationFn | undefined,
  selectedDataType: SelectableDataType,
  defaultAggregate?: ValidAggregationFn,
): Aggregate | undefined {
  // temporal data types don't support aggregation
  if (selectedDataType === "temporal") {
    return undefined;
  }

  if (aggregate === NONE_VALUE || aggregate === BIN_AGGREGATION) {
    return undefined;
  }

  if (!aggregate) {
    return defaultAggregate ? (defaultAggregate as Aggregate) : undefined;
  }

  if (selectedDataType === "string") {
    return STRING_AGGREGATION_FNS.includes(aggregate)
      ? (aggregate as Aggregate)
      : undefined;
  }
  return aggregate as Aggregate;
}
