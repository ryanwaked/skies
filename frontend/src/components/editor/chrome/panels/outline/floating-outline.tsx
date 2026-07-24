/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import React from "react";
import { scrollAndHighlightCell } from "@/components/editor/links/cell-link";
import { notebookOutline } from "@/core/cells/cells";
import type { OutlineItem } from "@/core/cells/outline";
import { cn } from "@/utils/cn";
import { type OutlineEntry, outlineEntriesAtom } from "./outline-entries";
import { OutlineHeadingRow } from "./outline-row";
import {
  findOutlineElements,
  scrollToOutlineItem,
  useActiveOutline,
} from "./useActiveOutline";

export const FloatingOutline: React.FC = () => {
  const { items } = useAtomValue(notebookOutline);
  const { activeHeaderId, activeOccurrences } = useActiveOutline(
    findOutlineElements(items),
  );
  const [isHovered, setIsHovered] = React.useState(false);

  // Hide if < 2 items
  // It's kinda useless to have an outline with only one item
  // and Notion does the same
  if (items.length < 2) {
    return null;
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "fixed top-[25vh] right-8 z-10000 print:hidden",
        // Hide on small screens
        "hidden md:block",
      )}
    >
      <OutlineList
        className={cn(
          "-top-4 max-h-[70vh] bg-background rounded-lg shadow-lg absolute overflow-auto transition-all duration-300 w-[300px] max-w-[calc(100vw-48px)] border z-overlay",
          // When hidden, the panel is non-interactive so it can't capture the
          // pointer as it slides back across the cursor — that re-entry was
          // what made the popup flicker in/out near the right edge.
          isHovered
            ? "left-[-280px] opacity-100 pointer-events-auto"
            : "left-[300px] opacity-0 pointer-events-none",
        )}
        items={items}
        activeHeaderId={activeHeaderId}
        activeOccurrences={activeOccurrences}
      />
      <MiniMap
        activeHeaderId={activeHeaderId}
        activeOccurrences={activeOccurrences}
      />
    </div>
  );
};

/**
 * The minimap tick strip: a compact, abstract representation of the
 * notebook's structure. Headings render as thin bars (width by level);
 * cells render as small filled blocks — distinct shapes so the strip reads
 * as a real structure map, not a uniform row of identical lines.
 */
export const MiniMap: React.FC<{
  activeHeaderId: string | undefined;
  activeOccurrences: number | undefined;
}> = ({ activeHeaderId, activeOccurrences }) => {
  const entries = useAtomValue(outlineEntriesAtom);
  // Map of selector to its occurrences
  const seen = new Map<string, number>();

  const renderEntry = (entry: OutlineEntry, idx: number) => {
    if (entry.kind === "cell") {
      return (
        <button
          key={entry.cellId}
          type="button"
          aria-label={entry.name ?? entry.preview ?? "cell"}
          className={cn(
            "h-[7px] rounded-[2px] bg-muted-foreground/50 hover:bg-primary/70 transition-colors",
            entry.indentLevel === 1 && "w-6",
            entry.indentLevel === 2 && "w-5",
            entry.indentLevel >= 3 && "w-4",
          )}
          onClick={() => scrollAndHighlightCell(entry.cellId, "focus")}
        />
      );
    }

    const { item } = entry;
    const identifier = "id" in item.by ? item.by.id : item.by.path;
    // Keep track of how many times we've seen this selector
    const occurrences = seen.get(identifier) ?? 0;
    seen.set(identifier, occurrences + 1);
    const isActive =
      occurrences === activeOccurrences && activeHeaderId === identifier;

    return (
      <button
        key={`${identifier}-${idx}`}
        type="button"
        aria-label={item.name}
        className={cn(
          "h-[2px] rounded-full bg-muted-foreground/60 hover:bg-primary transition-colors",
          item.level === 1 && "w-5",
          item.level === 2 && "w-4",
          item.level === 3 && "w-3",
          item.level === 4 && "w-2",
          isActive && "bg-primary",
        )}
        onClick={() => scrollToOutlineItem(item, occurrences)}
      />
    );
  };

  return (
    <div className="flex flex-col gap-2 items-end max-h-[70vh] overflow-hidden">
      {entries.map(renderEntry)}
    </div>
  );
};

export const OutlineList: React.FC<{
  className?: string;
  items: OutlineItem[];
  activeHeaderId: string | undefined;
  activeOccurrences: number | undefined;
}> = ({ items, activeHeaderId, activeOccurrences, className }) => {
  // Map of selector to its occurrences
  const seen = new Map<string, number>();
  return (
    <div className={cn("flex flex-col overflow-auto py-4 pl-2", className)}>
      {items.map((item, idx) => {
        const identifier = "id" in item.by ? item.by.id : item.by.path;
        // Keep track of how many times we've seen this selector
        const occurrences = seen.get(identifier) ?? 0;
        seen.set(identifier, occurrences + 1);

        return (
          <OutlineHeadingRow
            key={`${identifier}-${idx}`}
            item={item}
            occurrence={occurrences}
            isActive={
              occurrences === activeOccurrences && activeHeaderId === identifier
            }
          />
        );
      })}
    </div>
  );
};
