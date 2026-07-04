/* Copyright 2026 Marimo. All rights reserved. */

import type { TopLevelSpec } from "vega-lite";
import { describe, expect, it } from "vitest";
import { invariant } from "@/utils/invariant";
import {
  augmentSpecWithData,
  createSpecWithoutData,
  type ErrorMessage,
  X_AXIS_REQUIRED,
  Y_AXIS_REQUIRED,
} from "../chart-spec/spec";
import { ChartSchema, type ChartSchemaType } from "../schemas";
import { ChartType, NONE_VALUE } from "../types";

/**
 * Loosely-typed view of a unit spec for assertions.
 */
interface TestSpec {
  transform?: { fold: string[]; as: [string, string] }[];
  encoding?: Record<string, Record<string, unknown> | undefined>;
}

function asSpec(spec: TopLevelSpec | ErrorMessage): TestSpec {
  invariant(typeof spec !== "string", `Expected a spec, got error: ${spec}`);
  return spec as unknown as TestSpec;
}

describe("create vega spec", () => {
  // Sample data for testing
  const sampleData = [
    { category: "A", value: 10, group: "Group 1" },
    { category: "B", value: 20, group: "Group 1" },
    { category: "C", value: 15, group: "Group 1" },
    { category: "A", value: 5, group: "Group 2" },
    { category: "B", value: 10, group: "Group 2" },
    { category: "C", value: 25, group: "Group 2" },
  ];

  // Helper function to create basic form values
  const createBasicFormValues = (): ChartSchemaType => ({
    general: {
      title: "Test Chart",
      xColumn: {
        field: "category",
        type: "string" as const,
      },
      yColumn: {
        field: "value",
        type: "number" as const,
        aggregate: NONE_VALUE,
      },
    },
  });

  it("should create and augment a spec", () => {
    const spec = createSpecWithoutData(
      ChartType.BAR,
      createBasicFormValues(),
      "light",
      400,
      300,
    );
    expect(spec).toMatchSnapshot();
    expect(typeof spec !== "string").toBe(true); // Not error message
    expect((spec as TopLevelSpec).data).toEqual({ values: [] });

    // Augment the spec with data
    const augmentedSpec = augmentSpecWithData(spec as TopLevelSpec, sampleData);
    expect(augmentedSpec.data).toEqual({ values: sampleData });
  });

  it("should return an error message if the spec is invalid", () => {
    const formValues = createBasicFormValues();
    formValues.general!.xColumn!.field = undefined;

    const spec = createSpecWithoutData(
      ChartType.BAR,
      formValues,
      "light",
      400,
      300,
    );
    expect(spec).toEqual(X_AXIS_REQUIRED);

    // Undefined yColumn
    const formValues2 = createBasicFormValues();
    formValues2.general!.yColumn!.field = undefined;
    const spec2 = createSpecWithoutData(
      ChartType.BAR,
      formValues2,
      "light",
      400,
      300,
    );
    expect(spec2).toEqual(Y_AXIS_REQUIRED);
  });
});

describe("multi-series charts", () => {
  const createMultiSeriesFormValues = (): ChartSchemaType => ({
    general: {
      xColumn: {
        field: "date",
        type: "string" as const,
        selectedDataType: "string" as const,
      },
      yColumn: {
        field: "sales",
        type: "number" as const,
        selectedDataType: "number" as const,
        aggregate: "sum",
      },
      yColumns: [
        {
          field: "profit",
          type: "number" as const,
          selectedDataType: "number" as const,
        },
      ],
    },
  });

  it("should fold two y series for line charts", () => {
    const spec = asSpec(
      createSpecWithoutData(
        ChartType.LINE,
        createMultiSeriesFormValues(),
        "light",
        400,
        300,
      ),
    );

    expect(spec.transform).toEqual([
      { fold: ["sales", "profit"], as: ["series", "value"] },
    ]);
    // Y comes from the folded "value" field, with the shared aggregation
    expect(spec.encoding?.y).toMatchObject({
      field: "value",
      type: "quantitative",
      aggregate: "sum",
    });
    // Color is driven by the folded "series" field
    expect(spec.encoding?.color).toMatchObject({
      field: "series",
      type: "nominal",
    });
    expect(spec).toMatchSnapshot();
  });

  it("should group bars via xOffset when not stacking", () => {
    const spec = asSpec(
      createSpecWithoutData(
        ChartType.BAR,
        createMultiSeriesFormValues(),
        "light",
        400,
        300,
      ),
    );
    expect(spec.encoding?.xOffset).toEqual({ field: "series" });

    const stackedFormValues = createMultiSeriesFormValues();
    stackedFormValues.general!.stacking = true;
    const stackedSpec = asSpec(
      createSpecWithoutData(
        ChartType.BAR,
        stackedFormValues,
        "light",
        400,
        300,
      ),
    );
    expect(stackedSpec.encoding?.xOffset).toBeUndefined();
    expect(stackedSpec.encoding?.y).toMatchObject({ stack: true });
  });

  it("should ignore the explicit color-by column when multiple series are set", () => {
    const formValues = createMultiSeriesFormValues();
    formValues.general!.colorByColumn = {
      field: "group",
      type: "string" as const,
      selectedDataType: "string" as const,
    };
    const spec = asSpec(
      createSpecWithoutData(ChartType.LINE, formValues, "light", 400, 300),
    );
    expect(spec.encoding?.color).toMatchObject({ field: "series" });
  });

  it("should keep heatmaps single-series", () => {
    const spec = asSpec(
      createSpecWithoutData(
        ChartType.HEATMAP,
        createMultiSeriesFormValues(),
        "light",
        400,
        300,
      ),
    );
    expect(spec.transform).toBeUndefined();
    expect(spec.encoding?.y).toMatchObject({ field: "sales" });
  });
});

describe("axis scale, domain and format", () => {
  const createNumericFormValues = (): ChartSchemaType => ({
    general: {
      xColumn: {
        field: "category",
        type: "string" as const,
        selectedDataType: "string" as const,
      },
      yColumn: {
        field: "sales",
        type: "number" as const,
        selectedDataType: "number" as const,
        aggregate: NONE_VALUE,
      },
    },
  });

  it("should apply scale type and domain to the y-axis", () => {
    const formValues = createNumericFormValues();
    formValues.yAxis = { scale: "log", domainMin: 1, domainMax: 100 };

    const spec = asSpec(
      createSpecWithoutData(ChartType.LINE, formValues, "light", 400, 300),
    );
    expect(spec.encoding?.y?.scale).toEqual({
      type: "log",
      domain: [1, 100],
    });
  });

  it("should omit the domain for log scales with a non-positive min", () => {
    const formValues = createNumericFormValues();
    formValues.yAxis = { scale: "log", domainMin: 0, domainMax: 100 };

    const spec = asSpec(
      createSpecWithoutData(ChartType.LINE, formValues, "light", 400, 300),
    );
    expect(spec.encoding?.y?.scale).toEqual({ type: "log" });
  });

  it("should not apply scale overrides to non-numeric axes", () => {
    const formValues = createNumericFormValues();
    formValues.xAxis = { scale: "log", domainMin: 1 };

    const spec = asSpec(
      createSpecWithoutData(ChartType.LINE, formValues, "light", 400, 300),
    );
    // x is nominal, so the scale override is ignored
    expect(spec.encoding?.x?.scale).toBeUndefined();
  });

  it("should apply d3 number formats to axes", () => {
    const formValues = createNumericFormValues();
    formValues.xAxis = { format: "$,.0f" };
    formValues.yAxis = { format: ".0%" };

    const spec = asSpec(
      createSpecWithoutData(ChartType.BAR, formValues, "light", 400, 300),
    );
    expect(spec.encoding?.x?.axis).toEqual({ format: "$,.0f" });
    expect(spec.encoding?.y?.axis).toEqual({ format: ".0%" });
  });
});

describe("legend control", () => {
  const createColoredFormValues = (): ChartSchemaType => ({
    general: {
      xColumn: {
        field: "category",
        type: "string" as const,
        selectedDataType: "string" as const,
      },
      yColumn: {
        field: "sales",
        type: "number" as const,
        selectedDataType: "number" as const,
        aggregate: NONE_VALUE,
      },
      colorByColumn: {
        field: "group",
        type: "string" as const,
        selectedDataType: "string" as const,
      },
    },
  });

  it("should hide the legend when set to none", () => {
    const formValues = createColoredFormValues();
    formValues.color = { field: NONE_VALUE, legend: "none" };

    const spec = asSpec(
      createSpecWithoutData(ChartType.BAR, formValues, "light", 400, 300),
    );
    expect(spec.encoding?.color?.legend).toBeNull();
  });

  it("should orient the legend at the bottom", () => {
    const formValues = createColoredFormValues();
    formValues.color = { field: NONE_VALUE, legend: "bottom" };

    const spec = asSpec(
      createSpecWithoutData(ChartType.BAR, formValues, "light", 400, 300),
    );
    expect(spec.encoding?.color?.legend).toEqual({ orient: "bottom" });
  });

  it("should keep the default legend when set to right", () => {
    const formValues = createColoredFormValues();
    formValues.color = { field: NONE_VALUE, legend: "right" };

    const spec = asSpec(
      createSpecWithoutData(ChartType.BAR, formValues, "light", 400, 300),
    );
    expect(spec.encoding?.color?.legend).toBeUndefined();
  });
});

describe("backwards compatibility", () => {
  it("should parse an old-shape config (yColumn only) and render a spec", () => {
    // Shape of a chart config saved before multi-series, axis scale/format
    // and legend support was added
    const legacyConfig: unknown = JSON.parse(
      JSON.stringify({
        general: {
          title: "Legacy Chart",
          xColumn: {
            field: "category",
            type: "string",
            selectedDataType: "string",
          },
          yColumn: {
            field: "sales",
            type: "number",
            selectedDataType: "number",
            aggregate: "sum",
          },
        },
        xAxis: { label: "Category" },
        yAxis: { label: "Sales" },
        color: { field: "none", scheme: "default" },
        tooltips: { auto: true, fields: [] },
      }),
    );

    const config = ChartSchema.parse(legacyConfig);
    expect(config.general?.yColumns).toBeUndefined();
    expect(config.general?.yColumn?.field).toBe("sales");

    const spec = asSpec(
      createSpecWithoutData(ChartType.BAR, config, "light", 400, 300),
    );
    expect(spec.transform).toBeUndefined();
    expect(spec.encoding?.y).toMatchObject({
      field: "sales",
      aggregate: "sum",
      title: "Sales",
    });
  });
});
