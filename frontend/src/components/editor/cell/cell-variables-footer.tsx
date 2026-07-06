/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import { selectAtom } from "jotai/utils";
import { CornerDownRightIcon } from "lucide-react";
import { memo, useMemo } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { VariableName } from "@/components/variables/common";
import { useCellIds, useCellNames } from "@/core/cells/cells";
import type { CellId } from "@/core/cells/ids";
import { isInternalCellName } from "@/core/cells/names";
import type { Variable } from "@/core/variables/types";
import { variablesAtom } from "@/core/variables/state";

const MAX_CHIPS = 8;

/**
 * Equality for a cell's declared-variable slice: only the fields the footer
 * renders. Keeps a variable change in one cell from re-rendering every other
 * cell's footer (the atom emits only when *this* cell's slice actually
 * changes in a displayed way).
 */
function sameDeclared(a: Variable[], b: Variable[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((v, i) => {
    const w = b[i];
    return (
      v.name === w.name &&
      v.dataType === w.dataType &&
      v.declaredBy.length === w.declaredBy.length &&
      v.usedBy.length === w.usedBy.length &&
      v.usedBy.every((u, j) => u === w.usedBy[j])
    );
  });
}

/**
 * Hex-style cell outputs strip: the variables this cell returns, rendered
 * as type-colored chips beneath the output ("Most Hex cells return
 * variables ... shown directly beneath the cell"). Hover shows the type
 * and where the variable is referenced; click copies the name.
 */
export const CellVariablesFooter = memo(({ cellId }: { cellId: CellId }) => {
  const cellNames = useCellNames();
  const cellIds = useCellIds();

  // Subscribe only to this cell's declared variables (not the whole map),
  // so an update elsewhere doesn't recompute every footer.
  const declaredAtom = useMemo(
    () =>
      selectAtom(
        variablesAtom,
        (variables) =>
          Object.values(variables).filter((variable) =>
            variable.declaredBy.includes(cellId),
          ),
        sameDeclared,
      ),
    [cellId],
  );
  const declared = useAtomValue(declaredAtom);

  if (declared.length === 0) {
    return null;
  }

  const cellLabel = (id: CellId) => {
    const name = cellNames[id];
    if (!name || isInternalCellName(name)) {
      return `cell-${cellIds.inOrderIds.indexOf(id)}`;
    }
    return name;
  };

  const usedByLabel = (variable: Variable) => {
    const users = variable.usedBy.map(cellLabel);
    if (users.length === 0) {
      return "not referenced yet";
    }
    const shown = users.slice(0, 3).join(", ");
    return users.length > 3
      ? `used by ${shown}, +${users.length - 3} more`
      : `used by ${shown}`;
  };

  const shown = declared.slice(0, MAX_CHIPS);
  const overflow = declared.length - shown.length;

  return (
    <div
      data-testid="cell-variables-footer"
      className="flex flex-wrap items-center gap-1.5 px-3 py-[5px] print:hidden"
    >
      <CornerDownRightIcon
        className="h-3.5 w-3.5 shrink-0 text-[var(--foreground-dim)]"
        strokeWidth={1.5}
        aria-label="Returns"
      />
      {shown.map((variable) => (
        <Tooltip
          key={variable.name}
          delayDuration={300}
          content={
            <div className="flex flex-col gap-0.5 text-xs">
              <span className="font-code">{variable.name}</span>
              {variable.dataType && (
                <span className="text-muted-foreground">
                  {variable.dataType}
                </span>
              )}
              <span className="text-muted-foreground">
                {usedByLabel(variable)}
              </span>
              <span className="text-muted-foreground">Click to copy name</span>
            </div>
          }
        >
          {/* Tooltip needs a single focusable child; VariableName is a div. */}
          <span className="block min-w-0 max-w-[240px]">
            <VariableName
              name={variable.name}
              declaredBy={variable.declaredBy}
              dataType={variable.dataType}
            />
          </span>
        </Tooltip>
      ))}
      {overflow > 0 && (
        <span className="font-mono text-[10px] text-[var(--foreground-dim)]">
          +{overflow}
        </span>
      )}
    </div>
  );
});
CellVariablesFooter.displayName = "CellVariablesFooter";
