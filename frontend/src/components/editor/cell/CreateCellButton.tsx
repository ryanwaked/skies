/* Copyright 2026 Marimo. All rights reserved. */
import { useAtomValue } from "jotai";
import {
  BlocksIcon,
  ChartColumnIcon,
  DatabaseIcon,
  DatabaseZapIcon,
  DiamondPlusIcon,
  HashIcon,
  LayoutTemplateIcon,
  ListFilterIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  TableIcon,
  TablePropertiesIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/editor/inputs/Inputs";
import { MinimalHotkeys } from "@/components/shortcuts/renderShortcut";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useImperativeModal } from "@/components/modal/ImperativeModal";
import {
  maybeAddAltairImport,
  maybeAddMarimoImport,
} from "@/core/cells/add-missing-import";
import { useCellActions } from "@/core/cells/cells";
import { localComponentsAtom } from "@/core/components/local-components";
import { LanguageAdapters } from "@/core/codemirror/language/LanguageAdapters";
import { MARKDOWN_INITIAL_HIDE_CODE } from "@/core/codemirror/language/languages/markdown";
import {
  getConnectionTooltip,
  isAppInteractionDisabled,
} from "@/core/websocket/connection-utils";
import type { WebSocketState } from "@/core/websocket/types";
import { cn } from "@/utils/cn";
import { AddConnectionDialogContent } from "../connections/add-connection-dialog";
import {
  CHART_TEMPLATE,
  FILTER_TEMPLATE,
  INPUT_TEMPLATES,
  DATAFRAME_TEMPLATE,
  SECTION_TEMPLATE,
  SINGLE_VALUE_TEMPLATE,
  TABLE_TEMPLATE,
} from "./cell-insert-templates";
import { Tooltip } from "../../ui/tooltip";
import { MarkdownIcon, PythonIcon } from "./code/icons";

// A single, shared record of which "other cell types" modifiers are currently
// held. Read as a fallback at pointer-down time so a ⌘/Ctrl-click still opens
// the cell-type menu even when the pointer event's own modifier flag doesn't
// register — the cause of the "only works if I hold ⌘ *and* click" flakiness
// (the button calls preventDefault(), which also blocks the :focus fallback).
// One global listener set is shared across every CreateCellButton instance; a
// per-instance window listener would attach 2×(cell count) keydown handlers.
const heldModifiers = { mod: false, shift: false };
let modifierListenersInstalled = false;

function installModifierListeners(): void {
  if (modifierListenersInstalled || typeof window === "undefined") {
    return;
  }
  modifierListenersInstalled = true;
  window.addEventListener("keydown", (e) => {
    if (e.key === "Meta" || e.key === "Control") {
      heldModifiers.mod = true;
    } else if (e.key === "Shift") {
      heldModifiers.shift = true;
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "Meta" || e.key === "Control") {
      heldModifiers.mod = false;
    } else if (e.key === "Shift") {
      heldModifiers.shift = false;
    }
  });
  // A keyup can be missed when focus leaves the window (e.g. ⌘-Tab); treat any
  // window blur as "modifiers released" so a stale flag can't wrongly open the
  // menu on the next plain click.
  window.addEventListener("blur", () => {
    heldModifiers.mod = false;
    heldModifiers.shift = false;
  });
}

export const CreateCellButton = ({
  connectionState,
  onClick,
  tooltipContent,
  oneClickShortcut,
}: {
  connectionState: WebSocketState;
  tooltipContent: React.ReactNode;
  onClick:
    | ((opts: { code: string; hideCode?: boolean }) => void)
    | undefined;
  oneClickShortcut: "shift" | "mod";
}) => {
  const { createNewCell, addSetupCellIfDoesntExist } = useCellActions();
  const { openModal, closeModal } = useImperativeModal();
  const components = useAtomValue(localComponentsAtom);
  const shortcut = `${oneClickShortcut}-Click`;
  const [open, setOpen] = useState(false);
  const [justOpened, setJustOpened] = useState(false);
  const justOpenedTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    installModifierListeners();
    return () => {
      if (justOpenedTimerRef.current) {
        clearTimeout(justOpenedTimerRef.current);
      }
    };
  }, []);

  const scheduleClearJustOpened = () => {
    if (justOpenedTimerRef.current) {
      clearTimeout(justOpenedTimerRef.current);
    }
    justOpenedTimerRef.current = setTimeout(() => setJustOpened(false), 200);
  };

  const baseTooltipContent =
    getConnectionTooltip(connectionState) || tooltipContent;
  const finalTooltipContent = isAppInteractionDisabled(connectionState) ? (
    baseTooltipContent
  ) : (
    <div className="flex flex-col gap-4">
      <div>{baseTooltipContent}</div>
      <div className="text-xs text-muted-foreground font-medium pt-1 -mt-2 border-t border-border">
        {<MinimalHotkeys shortcut={shortcut} className="inline" />}{" "}
        <span>for other cell types</span>
      </div>
    </div>
  );

  const insertCell = (code?: string, opts: { hideCode?: boolean } = {}) => {
    onClick?.({ code: code ?? "", ...opts });
  };

  const addPythonCell = () => insertCell();

  // NB: When adding the marimo import for markdown/SQL/chart cells, we run
  // it automatically regardless of autoinstantiate/lazy-execution settings;
  // the user experience is confusing otherwise (how would they know they
  // need `import marimo as mo` first?).
  const addMarkdownCell = () => {
    maybeAddMarimoImport({ autoInstantiate: true, createNewCell });
    insertCell(LanguageAdapters.markdown.defaultCode, {
      hideCode: MARKDOWN_INITIAL_HIDE_CODE,
    });
  };

  const addSQLCell = () => {
    maybeAddMarimoImport({ autoInstantiate: true, createNewCell });
    insertCell(LanguageAdapters.sql.defaultCode);
  };

  const addTemplateCell =
    (code: string, opts: { needsAltair?: boolean; hideCode?: boolean } = {}) =>
    () => {
      maybeAddMarimoImport({ autoInstantiate: true, createNewCell });
      if (opts.needsAltair) {
        maybeAddAltairImport({ autoInstantiate: true, createNewCell });
      }
      insertCell(code, { hideCode: opts.hideCode });
    };

  const addSetupCell = () => addSetupCellIfDoesntExist({});

  const renderIcon = (icon: React.ReactNode) => {
    return <div className="mr-3 text-muted-foreground">{icon}</div>;
  };

  const openDropdown = () => {
    setOpen(true);
    setJustOpened(true);
    // Allow interactions after a brief delay to prevent the dropdown items immediately being clicked
    scheduleClearJustOpened();
  };

  // We use onPointerDownCapture (not onPointerDown) to intercept events in
  // capture phase before Radix's DropdownMenuTrigger sees them. Radix ignores
  // Ctrl+Click (likely to avoid interfering with browser), so we bypass its
  // trigger entirely and manage the dropdown's open state ourselves.
  const handlePointerDownCapture = (e: React.MouseEvent) => {
    // Ignore right-clicks, handled by onContextMenuCapture
    if (e.button === 2) {
      return;
    }

    // Don't propagate event to Radix
    e.preventDefault();
    e.stopPropagation();

    // Consult the shared held-modifier tracker as a fallback: a deliberate
    // ⌘/Ctrl-click should open the menu even if this pointer event's own
    // modifier flag didn't register the key.
    const hasModifier =
      oneClickShortcut === "shift"
        ? e.shiftKey || heldModifiers.shift
        : e.metaKey || e.ctrlKey || heldModifiers.mod;

    if (hasModifier) {
      openDropdown();
    } else {
      addPythonCell();
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openDropdown();
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setJustOpened(true);
      // Allow interactions after a brief delay
      scheduleClearJustOpened();
    }
  };

  const handleFirstItemClick = (e: React.MouseEvent) => {
    // Hack to prevent the first item from being clicked when the dropdown is opened
    if (justOpened) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    addPythonCell();
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild={true}>
        <Button
          className={cn(
            "border-none hover-action shadow-none! bg-transparent! focus-visible:outline-hidden",
            isAppInteractionDisabled(connectionState) && " inactive-button",
          )}
          onPointerDownCapture={handlePointerDownCapture}
          onContextMenuCapture={handleContextMenu}
          size="small"
          data-testid="create-cell-button"
        >
          <Tooltip content={finalTooltipContent}>
            <PlusIcon
              strokeWidth={1.8}
              size={14}
              className="opacity-60 hover:opacity-90"
            />
          </Tooltip>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" sideOffset={-30}>
        <DropdownMenuItem onClick={handleFirstItemClick}>
          {renderIcon(<PythonIcon />)}
          Python cell
        </DropdownMenuItem>
        <DropdownMenuItem onClick={addMarkdownCell}>
          {renderIcon(<MarkdownIcon />)}
          Markdown cell
        </DropdownMenuItem>
        <DropdownMenuItem onClick={addSQLCell}>
          {renderIcon(<DatabaseIcon size={13} strokeWidth={1.5} />)}
          SQL cell
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={addTemplateCell(CHART_TEMPLATE, { needsAltair: true })}
        >
          {renderIcon(<ChartColumnIcon size={13} strokeWidth={1.5} />)}
          Chart
        </DropdownMenuItem>
        <DropdownMenuItem onClick={addTemplateCell(DATAFRAME_TEMPLATE)}>
          {renderIcon(<TablePropertiesIcon size={13} strokeWidth={1.5} />)}
          Dataframe
        </DropdownMenuItem>
        <DropdownMenuItem onClick={addTemplateCell(SINGLE_VALUE_TEMPLATE)}>
          {renderIcon(<HashIcon size={13} strokeWidth={1.5} />)}
          Single value
        </DropdownMenuItem>
        <DropdownMenuItem onClick={addTemplateCell(TABLE_TEMPLATE)}>
          {renderIcon(<TableIcon size={13} strokeWidth={1.5} />)}
          Table
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {renderIcon(<SlidersHorizontalIcon size={13} strokeWidth={1.5} />)}
            Inputs
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {INPUT_TEMPLATES.map((input) => (
                <DropdownMenuItem
                  key={input.label}
                  onClick={addTemplateCell(input.code)}
                >
                  {input.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {renderIcon(<DatabaseZapIcon size={13} strokeWidth={1.5} />)}
            Data
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onClick={() =>
                  openModal(
                    <AddConnectionDialogContent onClose={closeModal} />,
                  )
                }
              >
                <DatabaseIcon className="mr-2 size-3.5" strokeWidth={1.5} />
                Add database connection
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {renderIcon(<BlocksIcon size={13} strokeWidth={1.5} />)}
            Components
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {components.length === 0 ? (
                <DropdownMenuItem disabled={true}>
                  No components yet
                </DropdownMenuItem>
              ) : (
                components.map((component) => (
                  <DropdownMenuItem
                    key={component.id}
                    onClick={addTemplateCell(component.code)}
                  >
                    {component.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={addTemplateCell(SECTION_TEMPLATE, {
            hideCode: MARKDOWN_INITIAL_HIDE_CODE,
          })}
        >
          {renderIcon(<LayoutTemplateIcon size={13} strokeWidth={1.5} />)}
          Section
        </DropdownMenuItem>
        <DropdownMenuItem onClick={addTemplateCell(FILTER_TEMPLATE)}>
          {renderIcon(<ListFilterIcon size={13} strokeWidth={1.5} />)}
          Filter
        </DropdownMenuItem>
        <DropdownMenuItem onClick={addSetupCell}>
          {renderIcon(<DiamondPlusIcon size={13} strokeWidth={1.5} />)}
          Setup cell
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
