/* Copyright 2026 Marimo. All rights reserved. */
"use no memo";

import {
  type ColumnDef,
  type ColumnSort,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import React, { memo, useMemo } from "react";
import { useLocale } from "react-aria";
import { useCellNames } from "@/core/cells/cells";
import type { CellId } from "@/core/cells/ids";
import { isInternalCellName } from "@/core/cells/names";
import type { Variable, Variables } from "@/core/variables/types";
import { sortBy } from "@/utils/arrays";
import { cn } from "@/utils/cn";
import { DataTableColumnHeader } from "../data-table/column-header";
import { SearchInput } from "../ui/input";
import { Tooltip } from "../ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { VariableName } from "./common";

interface Props {
  className?: string;
  /**
   * Used to sort the variables.
   */
  cellIds: CellId[];
  variables: Variables;
}

interface ResolvedVariable extends Variable {
  declaredByNames: string[];
  usedByNames: string[];
}

/* Column Definitions */

function columnDefOf<T>(columnDef: ColumnDef<ResolvedVariable, T>) {
  return columnDef;
}

const ColumnIds = {
  name: "name",
  type: "type",
  value: "value",
  // Retained as the default sort key (notebook declaration order) even
  // though the declared-by/used-by column no longer renders — that detail
  // lives in the name chip's tooltip now (Hex layout: NAME / TYPE / VALUE
  // single-line rows).
  defs: "defs-refs",
};

/** Tooltip body for a variable chip: provenance + the copy affordance. */
const VariableTooltip: React.FC<{ variable: ResolvedVariable }> = ({
  variable,
}) => (
  <div className="flex flex-col gap-0.5 text-xs">
    <span className="font-code">{variable.name}</span>
    <span className="text-muted-foreground">
      Declared by {variable.declaredByNames.join(", ") || "—"}
    </span>
    {variable.usedByNames.length > 0 && (
      <span className="text-muted-foreground">
        Used by{" "}
        {variable.usedByNames.length > 3
          ? `${variable.usedByNames.slice(0, 3).join(", ")}, +${variable.usedByNames.length - 3} more`
          : variable.usedByNames.join(", ")}
      </span>
    )}
    <span className="text-muted-foreground">Click to copy name</span>
  </div>
);

const COLUMNS = [
  columnDefOf({
    id: ColumnIds.name,
    // Fold provenance names into the accessor so global search still
    // matches "which variables does cell X touch".
    accessorFn: (v) =>
      `${v.name} ${v.declaredByNames.join(" ")} ${v.usedByNames.join(" ")}`,
    enableSorting: true,
    sortingFn: "alphanumeric",
    header: ({ column }) => (
      <DataTableColumnHeader header={"Name"} column={column} />
    ),
    cell: ({ row }) => (
      <Tooltip
        content={<VariableTooltip variable={row.original} />}
        delayDuration={300}
        side="right"
      >
        {/* Tooltip needs a focusable single child; VariableName is a div. */}
        <span className="block min-w-0 max-w-full">
          <VariableName
            name={row.original.name}
            declaredBy={row.original.declaredBy}
            dataType={row.original.dataType}
          />
        </span>
      </Tooltip>
    ),
  }),
  columnDefOf({
    id: ColumnIds.type,
    accessorFn: (v) => v.dataType,
    enableSorting: true,
    sortingFn: "alphanumeric",
    header: ({ column }) => (
      <DataTableColumnHeader header={"Type"} column={column} />
    ),
    cell: ({ getValue }) => (
      <div
        className="text-ellipsis overflow-hidden whitespace-nowrap text-[12px] text-foreground"
        title={getValue() ?? ""}
      >
        {getValue()}
      </div>
    ),
  }),
  columnDefOf({
    id: ColumnIds.value,
    accessorFn: (v) => v.value,
    enableSorting: false,
    header: ({ column }) => (
      <DataTableColumnHeader header={"Value"} column={column} />
    ),
    cell: ({ getValue }) => (
      <div
        className="text-ellipsis overflow-hidden whitespace-nowrap font-code text-[11.5px] text-muted-foreground"
        title={getValue() ?? ""}
      >
        {getValue()}
      </div>
    ),
  }),
];

/**
 * Sort the variables by the specified column sort
 * Defaults to the order they are defined in the notebook
 */
function sortData({
  variables,
  sort,
  cellIdToIndex,
}: {
  variables: ResolvedVariable[];
  sort: ColumnSort | undefined;
  cellIdToIndex: Map<CellId, number>;
}) {
  // Default to sort by the cell that defined it
  if (!sort) {
    sort = { id: ColumnIds.defs, desc: false };
  }

  let sortedVariables: ResolvedVariable[] = [];
  switch (sort.id) {
    case ColumnIds.name:
      sortedVariables = sortBy(variables, (v) => v.name);
      break;
    case ColumnIds.type:
      sortedVariables = sortBy(variables, (v) => v.dataType);
      break;
    case ColumnIds.defs:
      sortedVariables = sortBy(variables, (v) =>
        cellIdToIndex.get(v.declaredBy[0]),
      );
      break;
    default:
      // Unknown/stale sort key (e.g. a non-sortable column persisted from an
      // earlier version): fall back to the notebook's declaration order.
      sortedVariables = variables;
      break;
  }

  return sort.desc ? sortedVariables.toReversed() : sortedVariables;
}

export const VariableTable: React.FC<Props> = memo(
  ({ className, cellIds, variables }) => {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = React.useState("");
    const cellNames = useCellNames();
    const { locale } = useLocale();

    const resolvedVariables: ResolvedVariable[] = useMemo(() => {
      const getName = (id: CellId) => {
        const name = cellNames[id];
        if (isInternalCellName(name)) {
          return `cell-${cellIds.indexOf(id)}`;
        }
        return name ?? `cell-${cellIds.indexOf(id)}`;
      };

      return Object.values(variables).map((variable) => {
        return {
          ...variable,
          declaredByNames: variable.declaredBy.map(getName),
          usedByNames: variable.usedBy.map(getName),
        };
      });
    }, [variables, cellNames, cellIds]);

    const sortedVariables = useMemo(() => {
      const cellIdToIndex = new Map<CellId, number>();
      cellIds.forEach((id, index) => cellIdToIndex.set(id, index));
      return sortData({
        variables: resolvedVariables,
        sort: sorting[0],
        cellIdToIndex,
      });
    }, [resolvedVariables, sorting, cellIds]);

    const table = useReactTable({
      data: sortedVariables,
      columns: COLUMNS,
      getCoreRowModel: getCoreRowModel(),
      // filtering
      onGlobalFilterChange: setGlobalFilter,
      getFilteredRowModel: getFilteredRowModel(),
      enableFilters: true,
      enableGlobalFilter: true,
      enableColumnPinning: false,
      getColumnCanGlobalFilter(column) {
        // Opt-out only
        return column.columnDef.enableGlobalFilter ?? true;
      },
      globalFilterFn: "auto",
      // sorting
      manualSorting: true,
      locale: locale,
      onSortingChange: setSorting,
      getSortedRowModel: getSortedRowModel(),
      state: {
        sorting,
        globalFilter,
      },
    });

    return (
      <>
        <SearchInput
          className="w-full"
          placeholder="Search"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
        <Table
          className={cn(
            "w-full table-fixed text-[13px] flex-1 border-separate border-spacing-0",
            className,
          )}
        >
          {/* Hex variable-explorer grid (hex-sidebar-spec §5.8):
              NAME ~45% / TYPE ~25% / VALUE ~30%, single-line 28px rows,
              alignment only — no row borders, no zebra. */}
          <colgroup>
            <col className="w-[45%]" />
            <col className="w-[25%]" />
            <col className="w-[30%]" />
          </colgroup>
          <TableHeader>
            {/* Skies eyebrow: 11px mono uppercase, 0.08em tracking */}
            <TableRow className="whitespace-nowrap text-[11px] font-mono font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {table.getFlatHeaders().map((header) => (
                <TableHead
                  key={header.id}
                  className="sticky top-0 h-7 bg-card border-b overflow-hidden text-ellipsis"
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="h-7 hover:bg-[var(--hover-wash)]"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="py-0.5 px-2 overflow-hidden"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  },
);
VariableTable.displayName = "VariableTable";
