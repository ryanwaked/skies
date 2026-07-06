/* Copyright 2026 Marimo. All rights reserved. */

import { Objects } from "@/utils/objects";
import type { DataType, FieldTypes, VegaDataType } from "./vega-loader";

export type ContainerWidth = number | "container";

/**
 * Get the container width from a Vega-Lite spec.
 *
 * For unit specs, `width` is at the top level. For facet/repeat specs,
 * `width` is nested inside `spec`. This does not handle hconcat/vconcat and Vega spec
 * where the width may be a signal. These cases are covered by
 * the CSS fallback `.vega-embed:has(> .chart-wrapper.fit-x)`.
 */
export function getContainerWidth(spec: unknown): ContainerWidth | undefined {
  if (typeof spec === "object" && spec !== null) {
    if ("width" in spec) {
      return spec.width as ContainerWidth | undefined;
    }
    // Faceted/repeated spec
    if ("spec" in spec) {
      return getContainerWidth(spec.spec);
    }
  }
  return undefined;
}

/** Composite vega-lite operators whose inner views manage their own size. */
const COMPOSITE_KEYS = ["facet", "repeat", "concat", "hconcat", "vconcat", "spec"];

/**
 * Identity cache: the same input spec object must always yield the same
 * output object. react-vega re-embeds (tearing down the view mid-render)
 * whenever the spec prop identity changes, so callers that can't wrap
 * this in useMemo (e.g. inside OutputRenderer's switch) still need
 * referential stability across renders.
 */
const layoutCache = new WeakMap<object, object>();

/**
 * Skies layout default (Hex behavior): a single-view vega-lite spec with
 * no explicit width fills the cell column — width:"container" + fit-x
 * autosize. Left untouched: composite specs (container sizing breaks
 * their inner-view layout), full Vega specs (vegafusion path), and any
 * spec where the author set a width. Height is never injected — band
 * scales size row charts by category count and must keep doing so.
 */
export function withSkiesLayout<T extends object>(spec: T): T {
  const cached = layoutCache.get(spec);
  if (cached) {
    return cached as T;
  }
  const result = computeSkiesLayout(spec);
  layoutCache.set(spec, result);
  return result;
}

function computeSkiesLayout<T extends object>(spec: T): T {
  const record = spec as Record<string, unknown>;
  const schema = record.$schema;
  if (typeof schema === "string" && !schema.includes("vega-lite")) {
    return spec;
  }
  if (COMPOSITE_KEYS.some((key) => key in record)) {
    return spec;
  }
  if (record.width != null) {
    return spec;
  }
  // Respect an author-set autosize verbatim (string "none"/"fit"/"pad" or a
  // full object); only default to fit-x when none was provided.
  const autosize =
    record.autosize != null
      ? record.autosize
      : { type: "fit-x", contains: "padding" };
  return {
    ...spec,
    width: "container",
    autosize,
  };
}

export function mergeAsArrays<T>(
  left: T | T[] | undefined,
  right: T | T[] | undefined,
): T[] {
  return [...toArray(left), ...toArray(right)];
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}

export function getVegaFieldTypes(
  types: Record<string, DataType> | undefined | null,
): FieldTypes | "auto" {
  if (!types || Object.keys(types).length === 0) {
    // If fieldTypes is provided, use it to parse the data
    // Otherwise, infer the data types
    return "auto";
  }
  // Convert all 'date' to 'string', because dates don't format back to
  // the correct formatting. For example, a date like '2024-01-01' will
  // be formatted to '2024-01-01T00:00:00.000Z'.
  return Objects.mapValues(types, (type): VegaDataType => {
    if (type === "date") {
      return "string";
    }
    if (type === "time") {
      return "string";
    }
    if (type === "datetime") {
      return "date";
    }
    return type;
  });
}
