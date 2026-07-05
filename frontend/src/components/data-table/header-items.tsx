/* Copyright 2026 Marimo. All rights reserved. */

import { PinLeftIcon, PinRightIcon } from "@radix-ui/react-icons";
import type { Column, SortDirection, Table } from "@tanstack/react-table";
import {
  AlignJustifyIcon,
  ChevronDownIcon,
  ChevronsUpDown,
  ChevronUpIcon,
  CopyIcon,
  EyeOffIcon,
  FilterX,
  PinOffIcon,
  WrapTextIcon,
} from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import type { DataType } from "@/core/kernel/messages";
import { cn } from "@/utils/cn";
import { copyToClipboard } from "@/utils/copy";
import { DATA_TYPE_ICON } from "../datasets/icons";
import { formattingExample } from "./column-formatting/feature";
import { formatOptions } from "./column-formatting/types";
import { NAMELESS_COLUMN_PREFIX } from "./columns";

export function FormatOptions<TData, TValue>({
  column,
  locale,
}: {
  column: Column<TData, TValue>;
  locale: string;
}) {
  const dataType: DataType | undefined = column.columnDef.meta?.dataType;
  const columnFormatOptions = dataType ? formatOptions[dataType] : [];

  if (columnFormatOptions.length === 0 || !column.getCanFormat?.()) {
    return null;
  }
  const FormatIcon = DATA_TYPE_ICON[dataType || "unknown"];
  const currentFormat = column.getColumnFormatting?.();
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <FormatIcon strokeWidth={1.5} className="mo-dropdown-icon" />
        Format
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          <div className="text-xs text-muted-foreground px-2 py-1">
            Locale: {locale}
          </div>
          {Boolean(currentFormat) && (
            <>
              <DropdownMenuItem
                key={"clear"}
                variant={"danger"}
                className="text-xs"
                onClick={() => column.setColumnFormatting(undefined)}
              >
                Clear
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {columnFormatOptions.map((option) => (
            <DropdownMenuItem
              key={option}
              className={cn(
                "text-xs",
                currentFormat === option && "bg-primary/[0.07] text-primary",
              )}
              onClick={() => column.setColumnFormatting(option)}
            >
              {option}
              <span className="ml-auto pl-5 text-muted-foreground">
                {formattingExample(option, locale)}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}

export function ColumnWrapping<TData, TValue>({
  column,
}: {
  column: Column<TData, TValue>;
}) {
  if (!column.getCanWrap?.() || !column.getColumnWrapping) {
    return null;
  }

  const wrap = column.getColumnWrapping();
  if (wrap === "wrap") {
    return (
      <DropdownMenuItem onClick={() => column.toggleColumnWrapping("nowrap")}>
        <AlignJustifyIcon strokeWidth={1.5} className="mo-dropdown-icon" />
        No wrap text
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem onClick={() => column.toggleColumnWrapping("wrap")}>
      <WrapTextIcon strokeWidth={1.5} className="mo-dropdown-icon" />
      Wrap text
    </DropdownMenuItem>
  );
}

export function ColumnPinning<TData, TValue>({
  column,
}: {
  column: Column<TData, TValue>;
}) {
  if (!column.getCanPin?.() || !column.getIsPinned) {
    return null;
  }

  const pinnedPosition = column.getIsPinned();

  if (pinnedPosition !== false) {
    return (
      <DropdownMenuItem onClick={() => column.pin(false)}>
        <PinOffIcon strokeWidth={1.5} className="mo-dropdown-icon" />
        Unfreeze
      </DropdownMenuItem>
    );
  }

  return (
    <>
      <DropdownMenuItem onClick={() => column.pin("left")}>
        <PinLeftIcon className="mo-dropdown-icon" />
        Freeze left
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => column.pin("right")}>
        <PinRightIcon className="mo-dropdown-icon" />
        Freeze right
      </DropdownMenuItem>
    </>
  );
}

export function HideColumn<TData, TValue>({
  column,
}: {
  column: Column<TData, TValue>;
}) {
  if (!column.getCanHide()) {
    return null;
  }

  return (
    <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
      <EyeOffIcon strokeWidth={1.5} className="mo-dropdown-icon" />
      Hide column
    </DropdownMenuItem>
  );
}

export function CopyColumn<TData, TValue>({
  column,
}: {
  column: Column<TData, TValue>;
}) {
  if (!column.getCanCopy?.()) {
    return null;
  }

  if (column.id.startsWith(NAMELESS_COLUMN_PREFIX)) {
    return null;
  }

  return (
    <DropdownMenuItem onClick={async () => await copyToClipboard(column.id)}>
      <CopyIcon strokeWidth={1.5} className="mo-dropdown-icon" />
      Copy column name
    </DropdownMenuItem>
  );
}

// Skies column menus use thin directional chevrons, not the chunky
// sort-lines arrows.
const AscIcon = ChevronUpIcon;
const DescIcon = ChevronDownIcon;

/**
 * `table` is optional: it is only needed to detect multi-column sorting and
 * offer "Clear all sorts". Call sites that build their header inside column
 * definitions (where the table instance isn't yet in scope) omit it and fall
 * back to single-column "Clear sort".
 */
export function Sorts<TData, TValue>({
  column,
  table,
}: {
  column: Column<TData, TValue>;
  table?: Table<TData>;
}) {
  if (!column.getCanSort()) {
    return null;
  }

  const sortDirection = column.getIsSorted();
  const sortingIndex = column.getSortIndex();

  const sortingState = table?.getState().sorting;
  const hasMultiSort = sortingState?.length && sortingState.length > 1;

  const renderSortIndex = () => {
    return (
      <span className="ml-auto text-xs font-medium">{sortingIndex + 1}</span>
    );
  };

  const renderClearSort = () => {
    if (!sortDirection) {
      return null;
    }

    if (!hasMultiSort) {
      // render clear sort for this column
      return (
        <DropdownMenuItem onClick={() => column.clearSorting()}>
          <ChevronsUpDown strokeWidth={1.5} className="mo-dropdown-icon" />
          Clear sort
        </DropdownMenuItem>
      );
    }

    // render clear sort for all columns
    return (
      <DropdownMenuItem onClick={() => table?.resetSorting()}>
        <ChevronsUpDown strokeWidth={1.5} className="mo-dropdown-icon" />
        Clear all sorts
      </DropdownMenuItem>
    );
  };

  const toggleSort = (direction: SortDirection) => {
    // Clear sort if clicking the same direction
    if (sortDirection === direction) {
      column.clearSorting();
    } else {
      // Toggle sort direction
      const descending = direction === "desc";
      column.toggleSorting(descending, true);
    }
  };

  return (
    <>
      <DropdownMenuItem
        onClick={() => toggleSort("asc")}
        className={cn(
          sortDirection === "asc" && "bg-primary/[0.07] text-primary",
        )}
      >
        <AscIcon
          strokeWidth={1.5}
          className={
            // mo-dropdown-icon is unlayered CSS, so swap it out entirely to
            // tint the active direction.
            sortDirection === "asc"
              ? "mr-2 h-3.5 w-3.5 text-primary"
              : "mo-dropdown-icon"
          }
        />
        Asc
        {sortDirection === "asc" && renderSortIndex()}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => toggleSort("desc")}
        className={cn(
          sortDirection === "desc" && "bg-primary/[0.07] text-primary",
        )}
      >
        <DescIcon
          strokeWidth={1.5}
          className={
            sortDirection === "desc"
              ? "mr-2 h-3.5 w-3.5 text-primary"
              : "mo-dropdown-icon"
          }
        />
        Desc
        {sortDirection === "desc" && renderSortIndex()}
      </DropdownMenuItem>
      {renderClearSort()}
    </>
  );
}

export function renderSortIcon<TData, TValue>(column: Column<TData, TValue>) {
  if (!column.getCanSort()) {
    return null;
  }

  const isSorted = column.getIsSorted();

  const Icon: React.FC<React.SVGProps<SVGSVGElement>> = isSorted
    ? isSorted === "desc"
      ? DescIcon
      : AscIcon
    : ChevronsUpDown;

  return (
    <Icon
      strokeWidth={1.5}
      className={cn("h-3 w-3", isSorted && "text-primary")}
    />
  );
}

export function DataType<TData, TValue>({
  column,
}: {
  column: Column<TData, TValue>;
}) {
  const dtype: string | undefined = column.columnDef.meta?.dtype;
  if (!dtype) {
    return null;
  }

  return (
    <>
      {/* Skies section-header treatment: 10px mono uppercase muted. */}
      <div className="flex-1 px-2 py-1 text-[10px] font-mono font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {dtype}
      </div>
      <DropdownMenuSeparator />
    </>
  );
}

export const ClearFilterMenuItem = <TData, TValue>({
  column,
}: {
  column: Column<TData, TValue>;
}) => (
  <DropdownMenuItem onClick={() => column.setFilterValue(undefined)}>
    <FilterX strokeWidth={1.5} className="mo-dropdown-icon" />
    Clear filter
  </DropdownMenuItem>
);
