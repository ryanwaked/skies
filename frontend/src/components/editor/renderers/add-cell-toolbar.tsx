/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import {
  BlocksIcon,
  ChartColumnIcon,
  ChevronDownIcon,
  DatabaseIcon,
  DatabaseZapIcon,
  EllipsisIcon,
  HashIcon,
  LayoutTemplateIcon,
  ListFilterIcon,
  SlidersHorizontalIcon,
  SquareCodeIcon,
  SquareMIcon,
  TableIcon,
  TablePropertiesIcon,
  type LucideIcon,
} from "lucide-react";
import type React from "react";
import { useImperativeModal } from "@/components/modal/ImperativeModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CellColumnId } from "@/utils/id-tree";
import {
  maybeAddAltairImport,
  maybeAddMarimoImport,
} from "@/core/cells/add-missing-import";
import { useCellActions } from "@/core/cells/cells";
import { localComponentsAtom } from "@/core/components/local-components";
import {
  CHART_TEMPLATE,
  DATAFRAME_TEMPLATE,
  FILTER_TEMPLATE,
  INPUT_TEMPLATES,
  SECTION_TEMPLATE,
  SINGLE_VALUE_TEMPLATE,
  TABLE_TEMPLATE,
} from "../cell/cell-insert-templates";
import { LanguageAdapters } from "@/core/codemirror/language/LanguageAdapters";
import { MARKDOWN_INITIAL_HIDE_CODE } from "@/core/codemirror/language/languages/markdown";
import { canInteractWithAppAtom } from "@/core/network/connection";
import { cn } from "@/utils/cn";
import { useChromeActions } from "../chrome/state";
import { AddConnectionDialogContent } from "../connections/add-connection-dialog";

/**
 * Skies add-cell bar: one horizontal toolbar of cell types with
 * icon-over-label items, in place of marimo's Python/Markdown/SQL text
 * buttons. Items insert cells prefilled with the closest marimo
 * equivalent (mo.ui.table, mo.stat, mo.ui.dataframe, ...).
 *
 * Metrics are exact values inherited from the fork's original chrome
 * measurements (frontend/hex-measurements.json)
 * (see hex-measurements.json, addCellBar).
 */

interface ToolbarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  withChevron?: boolean;
}

// Spreads unknown props onto the <button> so it can be slotted into radix
// triggers via asChild (the trigger's handlers arrive as props).
const ToolbarItem: React.FC<ToolbarItemProps> = ({
  icon: Icon,
  label,
  withChevron,
  className,
  ...props
}) => (
  <button
    type="button"
    {...props}
    className={cn(
      "flex h-[52px] w-[64px] flex-col items-center justify-center gap-[4px] rounded-[3px] px-[2px] py-[4px]",
      "text-foreground transition-all",
      "hover:bg-[var(--hover-wash)] hover:text-primary hover:-translate-y-px",
      "data-[state=open]:bg-[var(--hover-wash)] data-[state=open]:text-primary",
      "focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
      "disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
  >
    <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={1.5} />
    <span className="flex items-center gap-0.5 text-[10px] font-normal whitespace-nowrap text-muted-foreground">
      {label}
      {withChevron && (
        <ChevronDownIcon
          className="size-3 text-muted-foreground"
          strokeWidth={1.5}
        />
      )}
    </span>
  </button>
);

export const AddCellToolbar: React.FC<{
  columnId: CellColumnId;
  className?: string;
}> = ({ columnId, className }) => {
  const { createNewCell } = useCellActions();
  const { openApplication } = useChromeActions();
  const { openModal, closeModal } = useImperativeModal();
  const canInteractWithApp = useAtomValue(canInteractWithAppAtom);
  const components = useAtomValue(localComponentsAtom);

  const insertCell = (
    code?: string,
    opts: { hideCode?: boolean; needsAltair?: boolean } = {},
  ) => {
    if (code !== undefined) {
      maybeAddMarimoImport({ autoInstantiate: true, createNewCell });
    }
    if (opts.needsAltair) {
      maybeAddAltairImport({ autoInstantiate: true, createNewCell });
    }
    createNewCell({
      cellId: { type: "__end__", columnId },
      before: false,
      code,
      hideCode: opts.hideCode,
    });
  };

  return (
    <div className="flex flex-col items-center mt-4 pt-6 pb-32 w-full px-4 print:hidden">
      <div className="skies-kicker mb-2">add cell</div>
      <div
        className={cn(
          // flex-wrap so narrow panels never clip the outer items. Soft
          // elevation (shadow-md) lifts the toolbar off the desk; hairline
          // border + rounded corners for the Skies paper-panel language.
          "flex flex-wrap justify-center items-stretch max-w-full rounded-[4px] bg-card p-[6px] border border-input shadow-md",
          className,
        )}
      >
        <ToolbarItem
          icon={DatabaseIcon}
          label="SQL Query"
          disabled={!canInteractWithApp}
          onClick={() => insertCell(LanguageAdapters.sql.defaultCode)}
        />
        <ToolbarItem
          icon={SquareCodeIcon}
          label="Python"
          disabled={!canInteractWithApp}
          onClick={() => insertCell()}
        />
        <ToolbarItem
          icon={SquareMIcon}
          label="Markdown"
          disabled={!canInteractWithApp}
          onClick={() =>
            insertCell(LanguageAdapters.markdown.defaultCode, {
              hideCode: MARKDOWN_INITIAL_HIDE_CODE,
            })
          }
        />
        <ToolbarItem
          icon={ChartColumnIcon}
          label="Chart"
          disabled={!canInteractWithApp}
          onClick={() => insertCell(CHART_TEMPLATE, { needsAltair: true })}
        />
        <ToolbarItem
          icon={TablePropertiesIcon}
          label="Dataframe"
          disabled={!canInteractWithApp}
          onClick={() => insertCell(DATAFRAME_TEMPLATE)}
        />
        <ToolbarItem
          icon={HashIcon}
          label="Single value"
          disabled={!canInteractWithApp}
          onClick={() => insertCell(SINGLE_VALUE_TEMPLATE)}
        />
        <ToolbarItem
          icon={TableIcon}
          label="Table"
          disabled={!canInteractWithApp}
          onClick={() => insertCell(TABLE_TEMPLATE)}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild={true} disabled={!canInteractWithApp}>
            <ToolbarItem
              icon={SlidersHorizontalIcon}
              label="Inputs"
              disabled={!canInteractWithApp}
              withChevron={true}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {INPUT_TEMPLATES.map((input) => (
              <DropdownMenuItem
                key={input.label}
                onSelect={() => insertCell(input.code)}
              >
                {input.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild={true} disabled={!canInteractWithApp}>
            <ToolbarItem
              icon={BlocksIcon}
              label="Components"
              disabled={!canInteractWithApp}
              withChevron={true}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {components.length === 0 ? (
              <DropdownMenuItem disabled={true}>
                No components yet — save a cell from its ··· menu
              </DropdownMenuItem>
            ) : (
              components.map((component) => (
                <DropdownMenuItem
                  key={component.id}
                  onSelect={() => insertCell(component.code)}
                >
                  <BlocksIcon className="mr-2 size-3.5" strokeWidth={1.5} />
                  {component.name}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuItem onSelect={() => openApplication("components")}>
              Manage components…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild={true} disabled={!canInteractWithApp}>
            <ToolbarItem
              icon={DatabaseZapIcon}
              label="Data"
              disabled={!canInteractWithApp}
              withChevron={true}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem
              onSelect={() =>
                openModal(<AddConnectionDialogContent onClose={closeModal} />)
              }
            >
              <DatabaseIcon className="mr-2 size-3.5" strokeWidth={1.5} />
              Add database connection
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openApplication("variables")}>
              <DatabaseZapIcon className="mr-2 size-3.5" strokeWidth={1.5} />
              Browse data sources
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild={true} disabled={!canInteractWithApp}>
            <ToolbarItem
              icon={EllipsisIcon}
              label="More"
              disabled={!canInteractWithApp}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem
              onSelect={() =>
                insertCell(SECTION_TEMPLATE, {
                  hideCode: MARKDOWN_INITIAL_HIDE_CODE,
                })
              }
            >
              <LayoutTemplateIcon className="mr-2 size-3.5" strokeWidth={1.5} />
              Section
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => insertCell(FILTER_TEMPLATE)}>
              <ListFilterIcon className="mr-2 size-3.5" strokeWidth={1.5} />
              Filter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
