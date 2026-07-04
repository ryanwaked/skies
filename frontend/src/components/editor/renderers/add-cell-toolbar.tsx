/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import {
  ChartColumnIcon,
  ChevronDownIcon,
  DatabaseIcon,
  DatabaseZapIcon,
  EllipsisIcon,
  HashIcon,
  LayoutTemplateIcon,
  ListFilterIcon,
  type LucideIcon,
  SlidersHorizontalIcon,
  SquareCodeIcon,
  SquareMIcon,
  TableIcon,
  TablePropertiesIcon,
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
import { LanguageAdapters } from "@/core/codemirror/language/LanguageAdapters";
import { MARKDOWN_INITIAL_HIDE_CODE } from "@/core/codemirror/language/languages/markdown";
import { canInteractWithAppAtom } from "@/core/network/connection";
import { cn } from "@/utils/cn";
import { useChromeActions } from "../chrome/state";
import { AddConnectionDialogContent } from "../connections/add-connection-dialog";

/**
 * Hex-style add-cell bar: one horizontal toolbar of cell types with
 * icon-over-label items and grouped dividers, in place of marimo's
 * Python/Markdown/SQL text buttons. Items insert cells prefilled with the
 * closest marimo equivalent (mo.ui.table, mo.stat, mo.ui.dataframe, ...).
 */

const CHART_TEMPLATE = `_chart = (
    alt.Chart(df)  # replace \`df\` with your dataframe
    .mark_bar()
    .encode(
        x="x_column",
        y="y_column",
    )
)
mo.ui.altair_chart(_chart)`;

const PIVOT_TEMPLATE = `# Group, aggregate, pivot, and filter interactively
mo.ui.dataframe(df)  # replace \`df\` with your dataframe`;

const SINGLE_VALUE_TEMPLATE = `mo.stat(
    value=0,
    label="Metric",
    caption="vs. previous period",
    direction="increase",
    bordered=True,
)`;

const TABLE_TEMPLATE = `mo.ui.table(df, page_size=10)  # replace \`df\` with your dataframe`;

const SECTION_TEMPLATE = `mo.md(r"""
# New section
""")`;

const FILTER_TEMPLATE = `_options = sorted(df["column"].unique())  # replace \`df\` and "column"
filter_values = mo.ui.multiselect(options=_options, label="Filter")
filter_values`;

const INPUT_TEMPLATES: Array<{ label: string; code: string }> = [
  {
    label: "Slider",
    code: 'slider = mo.ui.slider(start=0, stop=100, step=1, label="Slider")\nslider',
  },
  {
    label: "Number",
    code: 'number = mo.ui.number(start=0, stop=100, label="Number")\nnumber',
  },
  {
    label: "Text",
    code: 'text_input = mo.ui.text(placeholder="Enter text", label="Text")\ntext_input',
  },
  {
    label: "Dropdown",
    code: 'dropdown = mo.ui.dropdown(options=["a", "b", "c"], label="Dropdown")\ndropdown',
  },
  {
    label: "Multiselect",
    code: 'multiselect = mo.ui.multiselect(options=["a", "b", "c"], label="Multiselect")\nmultiselect',
  },
  {
    label: "Checkbox",
    code: 'checkbox = mo.ui.checkbox(label="Checkbox")\ncheckbox',
  },
  { label: "Switch", code: 'switch = mo.ui.switch(label="Switch")\nswitch' },
  { label: "Date", code: 'date_input = mo.ui.date(label="Date")\ndate_input' },
  {
    label: "Run button",
    code: 'run_button = mo.ui.run_button(label="Run")\nrun_button',
  },
];

interface ToolbarItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
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
      "flex min-w-18 flex-col items-center gap-1.5 rounded-[3px] px-3 py-2",
      "text-muted-foreground transition-colors",
      "hover:bg-[rgba(63,66,87,0.2)] hover:text-foreground",
      "data-[state=open]:bg-[rgba(63,66,87,0.2)] data-[state=open]:text-foreground",
      "disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
  >
    <Icon className="size-5 text-primary/80" strokeWidth={1.5} />
    <span className="flex items-center gap-0.5 text-xs whitespace-nowrap">
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

const GroupDivider: React.FC = () => (
  <div className="mx-1 my-2 w-px shrink-0 bg-border" />
);

export const AddCellToolbar: React.FC<{
  columnId: CellColumnId;
  className?: string;
}> = ({ columnId, className }) => {
  const { createNewCell } = useCellActions();
  const { openApplication } = useChromeActions();
  const { openModal, closeModal } = useImperativeModal();
  const canInteractWithApp = useAtomValue(canInteractWithAppAtom);

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
    <div className="flex justify-center mt-4 pt-6 pb-32 w-full print:hidden">
      <div
        className={cn(
          "flex items-stretch rounded-[3px] border border-border bg-card px-1.5 py-1",
          className,
        )}
      >
        <ToolbarItem
          icon={DatabaseIcon}
          label="SQL Query"
          disabled={!canInteractWithApp}
          onClick={() =>
            insertCell(LanguageAdapters.sql.defaultCode)
          }
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

        <GroupDivider />

        <ToolbarItem
          icon={ChartColumnIcon}
          label="Chart"
          disabled={!canInteractWithApp}
          onClick={() => insertCell(CHART_TEMPLATE, { needsAltair: true })}
        />
        <ToolbarItem
          icon={TablePropertiesIcon}
          label="Pivot"
          disabled={!canInteractWithApp}
          onClick={() => insertCell(PIVOT_TEMPLATE)}
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

        <GroupDivider />

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
