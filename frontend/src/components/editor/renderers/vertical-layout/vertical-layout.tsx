/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import {
  Check,
  Code2Icon,
  CodeIcon,
  FolderDownIcon,
  ImageIcon,
  Loader2Icon,
  MoreHorizontalIcon,
} from "lucide-react";
import type React from "react";
import { memo, useRef, useState } from "react";
import { z } from "zod";
import { ReadonlyCode } from "@/components/editor/code/readonly-python-code";
import { OutputArea } from "@/components/editor/Output";
import { ConsoleOutput } from "@/components/editor/output/console/ConsoleOutput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { outputIsLoading, outputIsStale } from "@/core/cells/cell";
import { useCellData, useCellRuntime } from "@/core/cells/cells";
import type { CellId } from "@/core/cells/ids";
import { isOutputEmpty } from "@/core/cells/outputs";
import type { CellData, CellRuntimeState } from "@/core/cells/types";
import { getReadonlyCodeDisplay } from "@/core/cells/readonly-code-display";
import { MarkdownLanguageAdapter } from "@/core/codemirror/language/languages/markdown";

// The adapter is stateless across `isSupported` calls, so one module-level
// instance serves every cell — avoids allocating a new parser per render.
const markdownAdapter = new MarkdownLanguageAdapter();
const isPureMarkdown = (code: string) => markdownAdapter.isSupported(code);
import { useResolvedMarimoConfig } from "@/core/config/config";
import { CSSClasses, KnownQueryParams } from "@/core/constants";
import type { OutputMessage } from "@/core/kernel/messages";
import { kernelStateAtom } from "@/core/kernel/state";
import { useNotebookCodeAvailable } from "@/core/meta/code-visibility";
import { showCodeInRunModeAtom } from "@/core/meta/state";
import {
  publishedCellClasses,
  shouldHidePublishedCell,
} from "@/core/cells/utils";
import { type AppMode, kioskModeAtom } from "@/core/mode";
import { useRequestClient } from "@/core/network/requests";
import type { CellConfig } from "@/core/network/types";
import { downloadAsHTML } from "@/core/static/download-html";
import { isStaticNotebook } from "@/core/static/static-state";
import { isWasm } from "@/core/wasm/utils";
import { cn } from "@/utils/cn";
import {
  ADD_PRINTING_CLASS,
  downloadBlob,
  downloadHTMLAsImage,
} from "@/utils/download";
import { Filenames } from "@/utils/filenames";
import { NotebookTitleBlock } from "../../notebook-title-block";
import { FloatingOutline } from "../../chrome/panels/outline/floating-outline";
import { cellDomProps } from "../../common";
import type { ICellRendererPlugin, ICellRendererProps } from "../types";
import { useDelayVisibility } from "./useDelayVisibility";
import { VerticalLayoutWrapper } from "./vertical-layout-wrapper";

type VerticalLayout = null;
type VerticalLayoutProps = ICellRendererProps<VerticalLayout>;

const VerticalLayoutRenderer: React.FC<VerticalLayoutProps> = ({
  cells,
  appConfig,
  mode,
}) => {
  const { invisible } = useDelayVisibility(cells.length, mode);
  const kioskMode = useAtomValue(kioskModeAtom);
  const kernelState = useAtomValue(kernelStateAtom);
  const [userConfig] = useResolvedMarimoConfig();
  const showCodeInRunModePreference = useAtomValue(showCodeInRunModeAtom);

  const urlParams = new URLSearchParams(window.location.search);
  const [showCode, setShowCode] = useState(() => {
    // Check if the setting was set in the mount options
    if (!showCodeInRunModePreference) {
      return false;
    }
    // If 'auto' or not found, use URL param
    // If url param is not set, we default to true for static notebooks, wasm notebooks, and kiosk mode
    const showCodeByQueryParam = urlParams.get(KnownQueryParams.showCode);
    return showCodeByQueryParam === null
      ? isStaticNotebook() || isWasm() || kioskMode
      : showCodeByQueryParam === "true";
  });

  const canShowCode = useNotebookCodeAvailable(cells);

  const renderCell = (cell: CellRuntimeState & CellData) => {
    return (
      <VerticalCellById
        key={cell.id}
        cellId={cell.id}
        cellOutputArea={userConfig.display.cell_output}
        showCode={showCode && canShowCode}
        mode={mode}
        kiosk={kioskMode}
        showErrorTracebacks={userConfig.runtime.show_tracebacks ?? false}
      />
    );
  };

  const renderCells = () => {
    if (appConfig.width === "columns") {
      const sortedColumns = groupCellsByColumn(cells);
      return (
        <div className="flex flex-row gap-8 w-full">
          {sortedColumns.map(([columnIndex, columnCells]) => (
            <div
              key={columnIndex}
              className="flex-1 flex flex-col gap-2 w-(--content-width)"
            >
              {columnCells.map(renderCell)}
            </div>
          ))}
        </div>
      );
    }

    if (cells.length === 0 && !invisible) {
      // If kernel is not yet instantiated, show loading state
      if (!kernelState.isInstantiated) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <Loader2Icon className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        );
      }
      // Kernel is ready but no cells - truly empty notebook
      return (
        <div className="flex-1 flex flex-col items-center justify-center py-8">
          <Alert variant="info">
            <AlertTitle>Empty Notebook</AlertTitle>
            <AlertDescription>
              This notebook has no code or outputs.
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return <>{cells.map(renderCell)}</>;
  };

  // in read mode (required for canShowCode to be true), we need to insert
  // spacing between cells to prevent them from colliding; in edit mode,
  // spacing is handled elsewhere
  return (
    <VerticalLayoutWrapper invisible={invisible} appConfig={appConfig}>
      {/* Same masthead as edit mode, so the published/read view opens with
          the title block instead of dropping straight into the first cell. */}
      {appConfig.width !== "columns" && cells.length > 0 && (
        <NotebookTitleBlock appConfig={appConfig} />
      )}
      <div className={cn("flex flex-col", showCode && canShowCode && "gap-5")}>
        {renderCells()}
      </div>
      {mode === "read" && (
        <ActionButtons
          canShowCode={canShowCode}
          showCode={showCode}
          onToggleShowCode={() => setShowCode((v) => !v)}
        />
      )}
      <FloatingOutline />
    </VerticalLayoutWrapper>
  );
};

const ActionButtons: React.FC<{
  canShowCode: boolean;
  showCode: boolean;
  onToggleShowCode: () => void;
}> = ({ canShowCode, showCode, onToggleShowCode }) => {
  const { readCode } = useRequestClient();

  const handleDownloadAsPNG = async () => {
    const app = document.getElementById("App");
    if (!app) {
      return;
    }
    await downloadHTMLAsImage({
      element: app,
      filename: document.title,
      // Add body.printing ONLY when converting the whole notebook to a screenshot
      prepare: ADD_PRINTING_CLASS,
    });
  };

  const handleDownloadAsHTML = async () => {
    const app = document.getElementById("App");
    if (!app) {
      return;
    }
    await downloadAsHTML({ filename: document.title, includeCode: true });
  };

  const handleDownloadAsPython = async () => {
    const code = await readCode();
    downloadBlob(
      new Blob([code.contents], { type: "text/plain" }),
      Filenames.toPY(document.title),
    );
  };

  const isStatic = isStaticNotebook();
  const actions: React.ReactNode[] = [];

  if (canShowCode) {
    actions.push(
      <DropdownMenuItem
        onSelect={onToggleShowCode}
        data-testid="notebook-action-show-code"
        key="show-code"
      >
        <Code2Icon className="mr-2" size={14} strokeWidth={1.5} />
        <span className="flex-1">Show code</span>
        {showCode && <Check className="h-4 w-4" />}
      </DropdownMenuItem>,
      <DropdownMenuSeparator key="show-code-separator" />,
    );
  }

  if (!isStatic) {
    actions.push(
      <DropdownMenuItem
        onSelect={handleDownloadAsHTML}
        data-testid="notebook-action-download-html"
        key="download-html"
      >
        <FolderDownIcon className="mr-2" size={14} strokeWidth={1.5} />
        Download as HTML
      </DropdownMenuItem>,
    );

    // Only show download as Python if code is available
    if (canShowCode) {
      actions.push(
        <DropdownMenuItem
          onSelect={handleDownloadAsPython}
          data-testid="notebook-action-download-python"
          key="download-python"
        >
          <CodeIcon className="mr-2" size={14} strokeWidth={1.5} />
          Download as .py
        </DropdownMenuItem>,
      );
    }

    actions.push(
      <DropdownMenuSeparator key="download-separator" />,
      <DropdownMenuItem
        onSelect={handleDownloadAsPNG}
        data-testid="notebook-action-download-png"
        key="download-png"
      >
        <ImageIcon className="mr-2" size={14} strokeWidth={1.5} />
        Download as PNG
      </DropdownMenuItem>,
    );
  }

  if (actions.length === 0) {
    return null;
  }

  // Don't change the id of this element
  // as this may be used in custom css to hide/show the actions dropdown
  return (
    <div
      data-testid="notebook-actions-dropdown"
      className={cn(
        "right-0 top-0 z-50 m-4 print:hidden flex gap-2",
        // If the notebook is static, we have a banner at the top, so
        // we can't use fixed positioning. Ideally this is sticky, but the
        // current dom structure makes that difficult.
        isStaticNotebook() ? "absolute" : "fixed",
      )}
    >
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild={true}>
          <Button variant="secondary" size="xs">
            <MoreHorizontalIcon className="w-4 h-4" strokeWidth={1.5} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="print:hidden w-[220px]">
          {actions}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

interface VerticalCellProps extends Pick<
  CellRuntimeState,
  | "output"
  | "consoleOutputs"
  | "status"
  | "stopped"
  | "errored"
  | "interrupted"
  | "staleInputs"
  | "runStartTimestamp"
> {
  cellOutputArea: "above" | "below";
  cellId: CellId;
  config: CellConfig;
  code: string;
  mode: AppMode;
  showCode: boolean;
  name: string;
  kiosk: boolean;
  showErrorTracebacks: boolean;
}

const VerticalCell = memo(
  ({
    output,
    consoleOutputs,
    cellOutputArea,
    cellId,
    status,
    stopped,
    errored,
    config,
    interrupted,
    staleInputs,
    runStartTimestamp,
    code,
    showCode,
    mode,
    name,
    kiosk,
    showErrorTracebacks,
  }: VerticalCellProps) => {
    const cellRef = useRef<HTMLDivElement>(null);

    const outputStale = outputIsStale(
      {
        status,
        output,
        interrupted,
        runStartTimestamp,
        staleInputs,
      },
      false,
    );
    const loading = outputIsLoading(status);

    // Kiosk and not presenting
    const kioskFull = kiosk && mode !== "present";

    const pureMarkdown = isPureMarkdown(code);
    const published = !showCode && !kioskFull;
    const className = cn(
      "marimo-cell",
      "hover-actions-parent empty:invisible",
      published
        ? publishedCellClasses({ errored, stopped })
        : {
            "has-error": errored,
            stopped: stopped,
            borderless: pureMarkdown,
          },
    );

    // Read mode and show code
    if ((mode === "read" && showCode) || kioskFull) {
      const outputArea = (
        <OutputArea
          allowExpand={true}
          output={output}
          className={CSSClasses.outputArea}
          cellId={cellId}
          stale={outputStale}
          loading={loading}
        />
      );

      // Hide the code if it's pure markdown and there's an output, or if the code is empty
      const hideCode = shouldHideCode(code, output);
      // Only unwrap SQL when the code will actually be rendered.
      const display = hideCode ? null : getReadonlyCodeDisplay(code);

      return (
        <div
          tabIndex={-1}
          ref={cellRef}
          className={className}
          {...cellDomProps(cellId, name)}
        >
          {cellOutputArea === "above" && outputArea}
          {display && (
            <div className="tray">
              <ReadonlyCode
                initiallyHideCode={config.hide_code}
                code={display.code}
                language={display.language}
              />
            </div>
          )}
          {cellOutputArea === "below" && outputArea}
          <ConsoleOutput
            consoleOutputs={consoleOutputs}
            stale={outputStale}
            interrupted={interrupted}
            cellName={name}
            onSubmitDebugger={() => null}
            cellId={cellId}
            debuggerActive={false}
          />
        </div>
      );
    }

    // When show_tracebacks is enabled, show error outputs inline
    // instead of hiding them
    const hidden = shouldHidePublishedCell({
      errored,
      interrupted,
      stopped,
      output,
      showErrorTracebacks,
    });
    if (hidden) {
      return null;
    }

    return (
      <div
        tabIndex={-1}
        ref={cellRef}
        className={className}
        {...cellDomProps(cellId, name)}
      >
        <OutputArea
          allowExpand={mode === "edit"}
          output={output}
          className={CSSClasses.outputArea}
          cellId={cellId}
          stale={outputStale}
          loading={loading}
        />
      </div>
    );
  },
);
VerticalCell.displayName = "VerticalCell";

/**
 * Per-cell wrapper that subscribes to its own atom slice, so a notebook-state
 * change only re-renders the cells whose data actually changed — not every
 * cell (which is what happens when the parent spreads fresh objects from
 * `flattenTopLevelNotebookCells`). Mirrors the edit-mode `CellComponent`
 * pattern of selecting `useCellData`/`useCellRuntime` per cell.
 */
const VerticalCellById = memo(
  ({
    cellId,
    cellOutputArea,
    showCode,
    mode,
    kiosk,
    showErrorTracebacks,
  }: {
    cellId: CellId;
    cellOutputArea: "above" | "below";
    showCode: boolean;
    mode: AppMode;
    kiosk: boolean;
    showErrorTracebacks: boolean;
  }) => {
    const cellData = useCellData(cellId);
    const cellRuntime = useCellRuntime(cellId);
    return (
      <VerticalCell
        key={cellId}
        cellId={cellId}
        output={cellRuntime.output}
        consoleOutputs={cellRuntime.consoleOutputs}
        status={cellRuntime.status}
        code={cellData.code}
        config={cellData.config}
        cellOutputArea={cellOutputArea}
        stopped={cellRuntime.stopped}
        showCode={showCode}
        errored={cellRuntime.errored}
        mode={mode}
        runStartTimestamp={cellRuntime.runStartTimestamp}
        interrupted={cellRuntime.interrupted}
        staleInputs={cellRuntime.staleInputs}
        name={cellData.name}
        kiosk={kiosk}
        showErrorTracebacks={showErrorTracebacks}
      />
    );
  },
);
VerticalCellById.displayName = "VerticalCellById";

export const VerticalLayoutPlugin: ICellRendererPlugin<
  VerticalLayout,
  VerticalLayout
> = {
  type: "vertical",
  name: "Vertical",
  validator: z.any(),
  Component: VerticalLayoutRenderer,
  deserializeLayout: (serialized) => serialized,
  serializeLayout: (layout) => layout,
  getInitialLayout: () => null,
};

export function groupCellsByColumn(
  cells: (CellRuntimeState & CellData)[],
): [number, (CellRuntimeState & CellData)[]][] {
  // Group cells by column
  const cellsByColumn = new Map<number, (CellRuntimeState & CellData)[]>();
  let lastSeenColumn = 0;
  cells.forEach((cell) => {
    const column = cell.config.column ?? lastSeenColumn;
    lastSeenColumn = column;
    if (!cellsByColumn.has(column)) {
      cellsByColumn.set(column, []);
    }
    cellsByColumn.get(column)?.push(cell);
  });

  // Sort columns by index
  return [...cellsByColumn.entries()].toSorted(([a], [b]) => a - b);
}

/**
 * Determine if the code should be hidden.
 *
 * This is used to hide the code if it's pure markdown and there's an output,
 * or if the code is empty.
 */
export function shouldHideCode(code: string, output: OutputMessage | null) {
  const pureMarkdown = isPureMarkdown(code);
  const hasOutput = output !== null && !isOutputEmpty(output);
  return (pureMarkdown && hasOutput) || code.trim() === "";
}
