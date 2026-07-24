/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import { ScrollTextIcon } from "lucide-react";
import React, { useMemo } from "react";
import { scrollAndHighlightCell } from "@/components/editor/links/cell-link";
import { useCellActions } from "@/core/cells/cells";
import type { CellId } from "@/core/cells/ids";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { cn } from "@/utils/cn";
import { notebookOutline } from "../../../../core/cells/cells";
import { PanelEmptyState } from "./empty-state";
import {
  PANEL_EYEBROW,
  PANEL_SEGMENTED_ITEM,
  PANEL_SEGMENTED_ITEM_ACTIVE,
  PANEL_SEGMENTED_ITEM_INACTIVE,
} from "./panel-styles";

import "./outline-panel.css";
import { outlineEntriesAtom } from "./outline/outline-entries";
import { OutlineCellRow, OutlineHeadingRow } from "./outline/outline-row";
import {
  findOutlineElements,
  useActiveOutline,
} from "./outline/useActiveOutline";

type OutlineMode = "headings" | "all";

const MODE_LABELS: Record<OutlineMode, string> = {
  headings: "Headings",
  all: "All cells",
};

const OutlinePanel: React.FC = () => {
  const { items } = useAtomValue(notebookOutline);
  const entries = useAtomValue(outlineEntriesAtom);
  const [mode, setMode] = useLocalStorage<OutlineMode>(
    "marimo:outline-panel-mode",
    "all",
  );
  const headerElements = useMemo(() => findOutlineElements(items), [items]);
  const { activeHeaderId, activeOccurrences } =
    useActiveOutline(headerElements);
  const { showCellIfHidden } = useCellActions();

  const handleCellClick = (cellId: CellId) => {
    showCellIfHidden({ cellId });
    requestAnimationFrame(() => {
      scrollAndHighlightCell(cellId, "focus");
    });
  };

  const visibleEntries =
    mode === "headings"
      ? entries.filter((entry) => entry.kind === "heading")
      : entries;

  const modeToggle = (
    <div className="flex items-center justify-between gap-0.5 px-3 py-1.5 shrink-0">
      <span className={PANEL_EYEBROW}>View</span>
      <div className="flex items-center gap-0.5">
        {(["headings", "all"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={cn(
              PANEL_SEGMENTED_ITEM,
              "cursor-pointer",
              mode === value
                ? PANEL_SEGMENTED_ITEM_ACTIVE
                : PANEL_SEGMENTED_ITEM_INACTIVE,
            )}
            onClick={() => setMode(value)}
          >
            {MODE_LABELS[value]}
          </button>
        ))}
      </div>
    </div>
  );

  if (visibleEntries.length === 0) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {modeToggle}
        <PanelEmptyState
          title="No outline found"
          description="Add markdown headings to your notebook to create an outline."
          icon={<ScrollTextIcon />}
        />
      </div>
    );
  }

  // Map of heading identifier to its occurrences, to disambiguate
  // repeated headings. Must match the iteration order of `notebookOutline`.
  const seen = new Map<string, number>();

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {modeToggle}
      <div className="outline-panel-tree flex flex-col overflow-y-auto overflow-x-hidden py-2 pl-2 pr-1 text-[13px]">
        {visibleEntries.map((entry, idx) => {
          if (entry.kind === "cell") {
            return (
              <OutlineCellRow
                key={entry.cellId}
                entry={entry}
                onClick={() => handleCellClick(entry.cellId)}
              />
            );
          }

          const { item } = entry;
          const identifier = "id" in item.by ? item.by.id : item.by.path;
          const occurrence = seen.get(identifier) ?? 0;
          seen.set(identifier, occurrence + 1);

          return (
            <OutlineHeadingRow
              key={`${identifier}-${idx}`}
              item={item}
              occurrence={occurrence}
              isActive={
                occurrence === activeOccurrences &&
                activeHeaderId === identifier
              }
            />
          );
        })}
      </div>
    </div>
  );
};

export default OutlinePanel;
