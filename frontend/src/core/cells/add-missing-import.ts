/* Copyright 2026 Marimo. All rights reserved. */

import { cellActionsState } from "../codemirror/cells/state";
import { updateEditorCodeFromPython } from "../codemirror/language/utils";
import { getRequestClient } from "../network/requests";
import { store } from "../state/jotai";
import { variablesAtom } from "../variables/state";
import { type CellActions, getCellEditorView, notebookAtom } from "./cells";
import { CellId } from "./ids";

const IMPORT_LINE = /^\s*(?:import|from)\s/;

/**
 * If the notebook already has an imports-only cell (every non-blank,
 * non-comment line is an `import`/`from`), append the missing import as a
 * new line at its end and re-run it — rather than spawning a separate
 * one-line import cell above the user's new cell. Returns true when it
 * handled the import; callers fall back to creating a cell otherwise.
 */
function tryAppendToExistingImportsCell(
  importStatement: string,
  autoInstantiate: boolean,
  appStore: typeof store,
): boolean {
  const { cellData, cellIds } = appStore.get(notebookAtom);
  const importsCellId = cellIds.inOrderIds.find((id) => {
    const lines = cellData[id].code
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
    return lines.length > 0 && lines.every((line) => IMPORT_LINE.test(line));
  });
  if (!importsCellId) {
    return false;
  }

  // Need the live editor view to keep CodeMirror and cell state in sync.
  const view = getCellEditorView(importsCellId);
  if (!view) {
    return false;
  }

  const newCode = `${cellData[importsCellId].code.trimEnd()}\n${importStatement}`;
  const actions = view.state.facet(cellActionsState);
  actions.updateCellCode({
    cellId: importsCellId,
    code: newCode,
    formattingChange: false,
  });
  updateEditorCodeFromPython(view, newCode);
  if (autoInstantiate) {
    void getRequestClient().sendRun({
      cellIds: [importsCellId],
      codes: [newCode],
    });
  }
  return true;
}

/**
 * Checks if any Python imports are missing from the current file and adds them if necessary.
 * @param moduleName The name of the module to import.
 * @param variableName The name of the variable to import.
 */
export function maybeAddMissingImport({
  moduleName,
  variableName,
  onAddImport,
  appStore = store,
}: {
  moduleName: string;
  variableName: string;
  onAddImport: (importStatement: string) => void;
  appStore?: typeof store;
}): boolean {
  // If variableName is already in the variables state,
  // then the import is not missing (or the name has been taken).
  const variables = appStore.get(variablesAtom);
  if (variableName in variables) {
    return false;
  }

  // Check if the import statement already exists in the notebook.
  const { cellData, cellIds } = appStore.get(notebookAtom);
  const regex = new RegExp(
    `import[ \t]+${moduleName}[ \t]+as[ \t]+${variableName}`,
    "g",
  );
  for (const cell of cellIds.inOrderIds) {
    if (regex.test(cellData[cell].code)) {
      return false;
    }
  }

  const importStatement = `import ${moduleName} as ${variableName}`;
  onAddImport(importStatement);

  return true;
}

/**
 * Adds a marimo import to the notebook if not already present.
 * @param autoInstantiate Whether to automatically run the cell.
 * @param createNewCell The function to create a new cell.
 * @param fromCellId The cell to add the import to.
 * @param before Whether to add the import before or after the cell.
 *
 * Returns the ID of the new cell if added, otherwise null.
 */
export function maybeAddMarimoImport({
  autoInstantiate,
  createNewCell,
  fromCellId,
  before,
}: {
  autoInstantiate: boolean;
  createNewCell: CellActions["createNewCell"];
  fromCellId?: CellId | null;
  before?: boolean;
}): CellId | null {
  const client = getRequestClient();
  let newCellId: CellId | null = null;
  const added = maybeAddMissingImport({
    moduleName: "marimo",
    variableName: "mo",
    onAddImport: (importStatement) => {
      // Prefer folding the import into an existing imports cell — but only
      // in the normal auto-instantiate flow. The AI staging flow passes
      // autoInstantiate=false and tracks the returned new-cell id so the
      // change can be reverted; editing an existing cell here would mutate
      // it outside that staged/revert system.
      if (
        autoInstantiate &&
        tryAppendToExistingImportsCell(importStatement, autoInstantiate, store)
      ) {
        return;
      }
      newCellId = CellId.create();
      createNewCell({
        cellId: fromCellId ?? "__end__",
        before: before ?? false,
        code: importStatement,
        lastCodeRun: autoInstantiate ? importStatement : undefined,
        newCellId: newCellId,
        skipIfCodeExists: true,
        autoFocus: false,
      });
      if (autoInstantiate) {
        void client.sendRun({
          cellIds: [newCellId],
          codes: [importStatement],
        });
      }
    },
  });
  return added ? newCellId : null;
}

export function maybeAddAltairImport({
  autoInstantiate,
  createNewCell,
  fromCellId,
}: {
  autoInstantiate: boolean;
  createNewCell: CellActions["createNewCell"];
  fromCellId?: CellId | null;
}): CellId | null {
  const client = getRequestClient();
  let newCellId: CellId | null = null;
  const added = maybeAddMissingImport({
    moduleName: "altair",
    variableName: "alt",
    onAddImport: (importStatement) => {
      if (
        autoInstantiate &&
        tryAppendToExistingImportsCell(importStatement, autoInstantiate, store)
      ) {
        return;
      }
      newCellId = CellId.create();
      createNewCell({
        cellId: fromCellId ?? "__end__",
        before: false,
        code: importStatement,
        lastCodeRun: autoInstantiate ? importStatement : undefined,
        newCellId: newCellId,
        skipIfCodeExists: true,
        autoFocus: false,
      });
      if (autoInstantiate) {
        void client.sendRun({
          cellIds: [newCellId],
          codes: [importStatement],
        });
      }
    },
  });
  return added ? newCellId : null;
}
