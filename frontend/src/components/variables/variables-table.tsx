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
import { SquareEqualIcon, WorkflowIcon } from "lucide-react";
import React, { memo, useMemo } from "react";
import { useLocale } from "react-aria";
import { CellLink } from "@/components/editor/links/cell-link";
import { getCellEditorView, useCellNames } from "@/core/cells/cells";
import type { CellId } from "@/core/cells/ids";
import { isInternalCellName } from "@/core/cells/names";
import { goToVariableDefinition } from "@/core/codemirror/go-to-definition/commands";
import type { Variable, Variables } from "@/core/variables/types";
import { sortBy } from "@/utils/arrays";
import { cn } from "@/utils/cn";
import { DataTableColumnHeader } from "../data-table/column-header";
import { CellLinkList } from "../editor/links/cell-link-list";
import { SearchInput } from "../ui/input";
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
  type: "type-value",
  defs: "defs-refs",
};

const COLUMNS = [
  columnDefOf({
    id: ColumnIds.name,
    accessorFn: (v) => [v.name, v.declaredBy] as const,
    enableSorting: true,
    sortingFn: "alphanumeric",
    header: ({ column }) => (
      <DataTableColumnHeader header={"Name"} column={column} />
    ),
    cell: ({ getValue }) => {
      const [name, declaredBy] = getValue();
      return <VariableName name={name} declaredBy={declaredBy} />;
    },
  }),
  columnDefOf({
    id: ColumnIds.type,
    accessorFn: (v) => [v.dataType, v.value] as const,
    enableSorting: true,
    sortingFn: "alphanumeric",
    header: ({ column }) => (
      <DataTableColumnHeader
        header={
          <div className="flex flex-col gap-1">
            <span>Type</span>
            <span>Value</span>
          </div>
        }
        column={column}
      />
    ),
    cell: ({ getValue }) => {
      const [dataType, value] = getValue();
      return (
        <div className="min-w-0 max-w-full">
          <div className="text-ellipsis overflow-hidden whitespace-nowrap text-muted-foreground text-[10.5px] font-mono uppercase tracking-[0.04em]">
            {dataType}
          </div>
          <div
            className="text-ellipsis overflow-hidden whitespace-nowrap font-code text-[11.5px] text-foreground mt-0.5"
            title={value ?? ""}
          >
            {value}
          </div>
        </div>
      );
    },
  }),
  columnDefOf({
    id: ColumnIds.defs,
    // Include declaredByNames and usedByNames for filtering
    accessorFn: (v) =>
      [
        v.declaredBy,
        v.usedBy,
        v.name,
        v.declaredByNames,
        v.usedByNames,
      ] as const,
    enableSorting: true,
    sortingFn: "basic",
    header: ({ column }) => (
      <DataTableColumnHeader
        header={
          <div className="flex flex-col gap-1">
            <span>Declared By</span>
            <span>Used By</span>
          </div>
        }
        column={column}
      />
    ),
    cell: ({ getValue }) => {
      const [declaredBy, usedBy, name] = getValue();

      // Highlight the variable in the cell editor
      const highlightInCell = (cellId: CellId) => {
        const editorView = getCellEditorView(cellId);
        if (editorView) {
          goToVariableDefinition(editorView, name);
        }
      };

      return (
        <div className="flex flex-col gap-1 py-1 min-w-0 max-w-full">
          <div className="flex flex-row flex-wrap min-w-0 gap-1.5 items-center">
            <span title="Declared by" className="shrink-0">
              <SquareEqualIcon
                className="w-3.5 h-3.5 text-muted-foreground"
                strokeWidth={1.5}
              />
            </span>

            {declaredBy.length === 1 ? (
              <CellLink
                variant="focus"
                cellId={declaredBy[0]}
                skipScroll={true}
                onClick={() => highlightInCell(declaredBy[0])}
              />
            ) : (
              <div className="text-destructive flex flex-row flex-wrap gap-1.5 min-w-0">
                {declaredBy.slice(0, 3).map((cellId) => (
                  <CellLink
                    variant="focus"
                    key={cellId}
                    cellId={cellId}
                    skipScroll={true}
                    className="whitespace-nowrap text-destructive"
                    onClick={() => highlightInCell(cellId)}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-row flex-wrap min-w-0 gap-1.5 items-baseline">
            <span title="Used by" className="shrink-0">
              <WorkflowIcon
                className="w-3.5 h-3.5 text-muted-foreground"
                strokeWidth={1.5}
              />
            </span>

            <CellLinkList
              maxCount={3}
              cellIds={usedBy}
              skipScroll={true}
              onClick={highlightInCell}
            />
          </div>
        </div>
      );
    },
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
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[34%]" />
            <col className="w-[38%]" />
          </colgroup>
          <TableHeader>
            {/* Skies section-header scale: 10px mono uppercase muted */}
            <TableRow className="whitespace-nowrap text-[10px] font-mono font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {table.getFlatHeaders().map((header) => (
                <TableHead
                  key={header.id}
                  className="sticky top-0 h-8 bg-card border-b overflow-hidden text-ellipsis"
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
              <TableRow key={row.id} className="hover:bg-[var(--hover-wash)]">
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="py-1.5 px-2 border-b overflow-hidden"
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
