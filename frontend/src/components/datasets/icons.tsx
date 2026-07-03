/* Copyright 2026 Marimo. All rights reserved. */

import {
  CalendarClockIcon,
  CalendarIcon,
  ClockIcon,
  CurlyBracesIcon,
  HashIcon,
  type LucideIcon,
  ToggleLeftIcon,
  TypeIcon,
} from "lucide-react";
import type { DataType } from "@/core/kernel/messages";
import { logNever } from "@/utils/assertNever";
import type { SelectableDataType } from "../data-table/charts/types";

/**
 * Maps a data type to an icon.
 */
export const DATA_TYPE_ICON: Record<DataType | SelectableDataType, LucideIcon> =
  {
    boolean: ToggleLeftIcon,
    date: CalendarIcon,
    time: ClockIcon,
    datetime: CalendarClockIcon,
    temporal: CalendarClockIcon,
    number: HashIcon,
    string: TypeIcon,
    integer: HashIcon,
    unknown: CurlyBracesIcon,
  };

/**
 * Hex-style quiet swatches: subtle token-based washes that hold on the
 * dark canvas — never saturated palette fills.
 */
export function getDataTypeColor(
  dataType: DataType | SelectableDataType,
): string {
  switch (dataType) {
    case "boolean":
      return "bg-action";
    case "date":
    case "time":
    case "datetime":
    case "temporal":
      return "bg-success/15";
    case "number":
    case "integer":
      return "bg-primary/15";
    case "string":
      return "bg-link/15";
    case "unknown":
      return "bg-muted-foreground/20";
    default:
      logNever(dataType);
      return "bg-muted-foreground/20";
  }
}
