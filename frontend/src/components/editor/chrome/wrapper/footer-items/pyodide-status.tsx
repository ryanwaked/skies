/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import type React from "react";
import { Spinner } from "@/components/icons/spinner";
import { Tooltip } from "@/components/ui/tooltip";
import { wasmInitializationAtom, wasmInitStatusAtom } from "@/core/wasm/state";
import { isWasm } from "@/core/wasm/utils";

/**
 * Footer indicator that surfaces Pyodide initialization progress. Mirrors
 * the "Kernel" indicator but tracks the WASM runtime instead of the server
 * connection. Hides itself once Pyodide is ready.
 */
export const PyodideStatus: React.FC = () => {
  const status = useAtomValue(wasmInitStatusAtom);
  const message = useAtomValue(wasmInitializationAtom);

  if (!isWasm() || status === "ready") {
    return null;
  }

  const icon =
    status === "error" ? (
      <span className="size-1.5 rounded-full bg-error" />
    ) : (
      <Spinner size="small" />
    );

  const tooltip = status === "error" ? "Pyodide failed to initialize" : message;

  return (
    <Tooltip
      content={<div className="text-sm whitespace-pre-line">{tooltip}</div>}
      data-testid="footer-pyodide-status"
    >
      <div
        className="h-6 px-1.5 hover:bg-[rgba(63,66,87,0.2)] rounded-sm flex items-center gap-1.5 text-[11px] text-muted-foreground"
        data-testid="pyodide-status"
      >
        {icon}
        <span>Pyodide</span>
      </div>
    </Tooltip>
  );
};
