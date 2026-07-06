/* Copyright 2026 Marimo. All rights reserved. */

import { InfoIcon, TriangleAlert } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { Accordion } from "@/components/ui/accordion";
import { Tooltip } from "@/components/ui/tooltip";
import { capitalize } from "@/utils/strings";
import { isFieldSet } from "../chart-spec/spec";
import { ColorByAxis, Facet, XAxis, YAxis } from "../components/chart-items";
import {
  BooleanField,
  ColorArrayField,
  InputField,
  NumberField,
  SelectField,
  SliderField,
  TooltipSelect,
} from "../components/form-fields";
import {
  AccordionFormContent,
  AccordionFormItem,
  AccordionFormTrigger,
  FieldSection,
  FormSectionHorizontalRule,
  Title,
} from "../components/layouts";
import {
  COLOR_SCHEMES,
  DEFAULT_AXIS_SCALE,
  DEFAULT_COLOR_SCHEME,
  DEFAULT_LEGEND_POSITION,
  MULTI_SERIES_CHART_TYPES,
} from "../constants";
import { useChartFormContext } from "../context";
import type { ChartSchemaType } from "../schemas";
import {
  AXIS_SCALE_TYPES,
  ChartType,
  COLOR_BY_FIELDS,
  LEGEND_POSITIONS,
  NONE_VALUE,
} from "../types";

export const CommonChartForm: React.FC = () => {
  const form = useFormContext<ChartSchemaType>();

  const formValues = useWatch({ control: form.control });
  const yColumn = formValues.general?.yColumn;
  const groupByColumn = formValues.general?.colorByColumn;

  const yColumnExists = isFieldSet(yColumn?.field);

  const { chartType } = useChartFormContext();

  // When 2+ Y series are set, the chart is colored by series and the
  // explicit color-by column is ignored.
  const seriesCount = [yColumn, ...(formValues.general?.yColumns ?? [])].filter(
    (column) => isFieldSet(column?.field),
  ).length;
  const hasMultipleSeries =
    MULTI_SERIES_CHART_TYPES.includes(chartType) && seriesCount > 1;

  const showStacking =
    (isFieldSet(groupByColumn?.field) || hasMultipleSeries) &&
    (chartType === ChartType.BAR || chartType === ChartType.LINE);

  return (
    <>
      <Tooltip
        delayDuration={100}
        content="To persist a chart, add the generated Python code to a new cell."
      >
        <div className="flex items-center gap-1.5">
          <TriangleAlert
            className="h-3 w-3 text-muted-foreground"
            strokeWidth={1.5}
          />
          <p className="text-xs text-muted-foreground">Charts are not saved.</p>
        </div>
      </Tooltip>

      <XAxis />
      <YAxis />

      {yColumnExists && (
        <>
          {hasMultipleSeries ? (
            <FieldSection>
              <Title text="Color by" />
              <p className="text-xs text-muted-foreground">
                Color by is controlled by series.
              </p>
            </FieldSection>
          ) : (
            <ColorByAxis />
          )}
          {showStacking && (
            <div className="flex flex-row gap-2">
              <BooleanField fieldName="general.stacking" label="Stacked" />
            </div>
          )}
        </>
      )}

      <FormSectionHorizontalRule />
      <OtherOptions />
    </>
  );
};

export const StyleForm: React.FC = () => {
  const { chartType } = useChartFormContext();

  return (
    <Accordion type="multiple">
      <AccordionFormItem value="general">
        <AccordionFormTrigger className="pt-0">
          <Title text="General" />
        </AccordionFormTrigger>
        <AccordionFormContent>
          <InputField label="Plot title" fieldName="general.title" />
          <BooleanField
            fieldName="style.gridLines"
            label="Show grid lines"
            defaultValue={chartType === ChartType.SCATTER}
          />
        </AccordionFormContent>
      </AccordionFormItem>

      <AccordionFormItem value="xAxis">
        <AccordionFormTrigger>
          <Title text="X-Axis" />
        </AccordionFormTrigger>
        <AccordionFormContent>
          <InputField label="Label" fieldName="xAxis.label" />
          <SliderField
            fieldName="xAxis.width"
            label="Width"
            defaultValue={400}
            start={200}
            stop={800}
          />
          <AxisStyleOptions axis="xAxis" />
        </AccordionFormContent>
      </AccordionFormItem>

      <AccordionFormItem value="yAxis">
        <AccordionFormTrigger>
          <Title text="Y-Axis" />
        </AccordionFormTrigger>
        <AccordionFormContent>
          <InputField label="Label" fieldName="yAxis.label" />
          <SliderField
            fieldName="yAxis.height"
            label="Height"
            defaultValue={300}
            start={150}
            stop={600}
          />
          <AxisStyleOptions axis="yAxis" />
        </AccordionFormContent>
      </AccordionFormItem>

      <AccordionFormItem value="color">
        <AccordionFormTrigger>
          <Title text="Color" />
        </AccordionFormTrigger>
        <AccordionFormContent>
          <SelectField
            fieldName="color.field"
            label="Field"
            options={COLOR_BY_FIELDS.map((field) => ({
              display: capitalize(field),
              value: field,
            }))}
            defaultValue={NONE_VALUE}
          />
          <SelectField
            fieldName="color.scheme"
            label="Color scheme"
            defaultValue={DEFAULT_COLOR_SCHEME}
            options={COLOR_SCHEMES.map((scheme) => ({
              display: capitalize(scheme),
              value: scheme,
            }))}
          />
          <SelectField
            fieldName="color.legend"
            label="Legend"
            defaultValue={DEFAULT_LEGEND_POSITION}
            options={LEGEND_POSITIONS.map((position) => ({
              display: capitalize(position),
              value: position,
            }))}
          />
          <ColorArrayField fieldName="color.range" label="Color range" />
          <p className="text-xs text-muted-foreground">
            <InfoIcon
              className="w-2.5 h-2.5 inline mb-1 mr-1"
              strokeWidth={1.5}
            />
            If you are using color range, color scheme will be ignored.
          </p>
        </AccordionFormContent>
      </AccordionFormItem>
    </Accordion>
  );
};

const FORMAT_TOOLTIP = (
  <div className="flex flex-col gap-0.5 text-xs">
    <span>d3-format string, e.g.</span>
    <span className="font-mono">",.2f" &rarr; 1,234.57</span>
    <span className="font-mono">"$,.0f" &rarr; $1,235</span>
    <span className="font-mono">".0%" &rarr; 12%</span>
  </div>
);

/**
 * Scale type, domain and number format controls, shared between the
 * X-Axis and Y-Axis style sections.
 */
const AxisStyleOptions: React.FC<{ axis: "xAxis" | "yAxis" }> = ({ axis }) => {
  return (
    <>
      <SelectField
        fieldName={`${axis}.scale`}
        label="Scale"
        defaultValue={DEFAULT_AXIS_SCALE}
        options={AXIS_SCALE_TYPES.map((scale) => ({
          display: capitalize(scale),
          value: scale,
        }))}
      />
      {/* Two-column grid so each domain input grows to fill its half
          (was fixed w-14 / 56px, which clipped signed/decimal values). */}
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          fieldName={`${axis}.domainMin`}
          label="Min"
          className="justify-between"
          inputClassName="flex-1 min-w-0"
          minValue={Number.MIN_SAFE_INTEGER}
          placeholder="auto"
        />
        <NumberField
          fieldName={`${axis}.domainMax`}
          label="Max"
          className="justify-between"
          inputClassName="flex-1 min-w-0"
          minValue={Number.MIN_SAFE_INTEGER}
          placeholder="auto"
        />
      </div>
      <InputField
        fieldName={`${axis}.format`}
        label="Format"
        placeholder=",.2f"
        tooltip={FORMAT_TOOLTIP}
      />
    </>
  );
};

export const OtherOptions: React.FC = () => {
  const { saveForm } = useChartFormContext();

  const form = useFormContext<ChartSchemaType>();
  const formValues = useWatch({ control: form.control });
  const autoTooltips = formValues.tooltips?.auto;

  return (
    <Accordion type="multiple">
      <AccordionFormItem value="facet">
        <AccordionFormTrigger className="pt-0">
          <Title
            text="Faceting"
            tooltip="Repeat the chart for each unique field value"
          />
        </AccordionFormTrigger>
        <AccordionFormContent>
          <Facet />
        </AccordionFormContent>
      </AccordionFormItem>

      <AccordionFormItem value="tooltips">
        <AccordionFormTrigger>
          <Title text="Tooltips" />
        </AccordionFormTrigger>
        <AccordionFormContent wrapperClassName="flex-row justify-between">
          <BooleanField
            fieldName="tooltips.auto"
            label="Include X, Y and Color"
          />
          {!autoTooltips && (
            <TooltipSelect
              fieldName="tooltips.fields"
              saveFunction={saveForm}
            />
          )}
        </AccordionFormContent>
      </AccordionFormItem>
    </Accordion>
  );
};
