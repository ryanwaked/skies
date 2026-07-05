/* Copyright 2026 Marimo. All rights reserved. */

import {
  CodeIcon,
  DatabaseIcon,
  type LucideIcon,
  TextIcon,
} from "lucide-react";
import type React from "react";
import type { OutlineItem } from "@/core/cells/outline";
import type { LanguageAdapterType } from "@/core/codemirror/language/types";
import { cn } from "@/utils/cn";
import type { CellEntry } from "./outline-entries";
import { scrollToOutlineItem } from "./useActiveOutline";

/**
 * A single heading row, shared between the floating outline overlay and the
 * outline sidebar panel.
 */
export const OutlineHeadingRow: React.FC<{
  item: OutlineItem;
  occurrence: number;
  isActive: boolean;
}> = ({ item, occurrence, isActive }) => {
  const sharedProps = {
    className: cn(
      "text-[13px] px-2 py-1 cursor-pointer rounded-[3px] hover:bg-[var(--hover-wash)] hover:text-foreground",
      item.level === 1 && "font-medium",
      // Subtle indent guides for nested headings
      item.level === 2 && "ml-3 border-l border-border/60",
      item.level === 3 && "ml-6 border-l border-border/60",
      item.level === 4 && "ml-9 border-l border-border/60",
      isActive &&
        "bg-primary/[0.07] text-primary hover:bg-primary/[0.07] hover:text-primary",
    ),
    onClick: () => scrollToOutlineItem(item, occurrence),
  };

  if (item.html) {
    return (
      <div {...sharedProps} dangerouslySetInnerHTML={{ __html: item.html }} />
    );
  }

  return <div {...sharedProps}>{item.name}</div>;
};

const LANGUAGE_ICONS: Record<LanguageAdapterType, LucideIcon> = {
  python: CodeIcon,
  sql: DatabaseIcon,
  markdown: TextIcon,
};

/**
 * A cell-level row in the outline sidebar panel: a small language glyph plus
 * the cell name (when user-named) or its first non-empty line of code.
 */
export const OutlineCellRow: React.FC<{
  entry: CellEntry;
  onClick: () => void;
}> = ({ entry, onClick }) => {
  const Icon = LANGUAGE_ICONS[entry.language];
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 min-w-0 px-2 py-1 cursor-pointer rounded-[3px]",
        "hover:bg-[var(--hover-wash)] hover:text-foreground",
        // Indent guide at the level of the current section
        "border-l border-border/60",
        entry.indentLevel === 2 && "ml-3",
        entry.indentLevel === 3 && "ml-6",
        entry.indentLevel === 4 && "ml-9",
      )}
      onClick={onClick}
    >
      <Icon
        className="h-3 w-3 shrink-0 text-muted-foreground"
        strokeWidth={1.5}
      />
      {entry.name ? (
        <span className="font-code text-[11px] truncate">{entry.name}</span>
      ) : (
        <span
          className={cn(
            "text-[12px] text-muted-foreground truncate",
            !entry.preview && "italic",
          )}
        >
          {entry.preview || "empty cell"}
        </span>
      )}
    </div>
  );
};
