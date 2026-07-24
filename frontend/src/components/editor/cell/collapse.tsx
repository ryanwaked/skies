/* Copyright 2026 Marimo. All rights reserved. */

import {
  AlertOctagonIcon,
  ChevronDownIcon,
  Loader2Icon,
  RefreshCcw,
} from "lucide-react";
import type React from "react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useNotebook } from "@/core/cells/cells";
import type { CellId } from "@/core/cells/ids";
import { getDescendantsStatus } from "@/core/cells/utils";
import { cn } from "@/utils/cn";

interface Props {
  isCollapsed: boolean;
  canCollapse: boolean;
  onClick: () => void;
}

export const CollapseToggle: React.FC<Props> = (props) => {
  // It could be collapsed, but the markdown headers were removed.
  // So we still want to be able to expand it, if it is collapsed.
  if (!props.canCollapse && !props.isCollapsed) {
    return null;
  }

  return (
    <Button variant="text" size="icon" onClick={props.onClick}>
      <Tooltip content={props.isCollapsed ? "Expand" : "Collapse"}>
        <span>
          <Arrow isCollapsed={props.isCollapsed} />
        </span>
      </Tooltip>
    </Button>
  );
};

const Arrow = ({ isCollapsed }: { isCollapsed: boolean }) => {
  // Skies section chevron: single glyph that rotates when the
  // section is collapsed.
  return (
    <ChevronDownIcon
      className={cn(
        "shrink-0 text-muted-foreground transition-transform",
        isCollapsed && "-rotate-90",
      )}
      strokeWidth={1.5}
      size={16}
    />
  );
};

export const CollapsedCellBanner: React.FC<{
  onClick: () => void;
  cellId: CellId;
  count: number;
}> = memo(({ onClick, count, cellId }) => {
  const notebook = useNotebook();
  const states = getDescendantsStatus(notebook, cellId);

  // Skies collapsed-section indicator: the heading row stays as-is,
  // followed by a subtle "N cells" chip.
  return (
    <div className="flex items-center gap-2 mx-1 mt-1">
      <Tooltip content="Expand section" delayDuration={100}>
        <button
          type="button"
          onClick={onClick}
          data-testid="collapsed-cells-chip"
          className={cn(
            "text-[10px] uppercase tracking-wider leading-none",
            "text-muted-foreground bg-muted rounded-[3px] px-1.5 py-1",
            "cursor-pointer hover:bg-[var(--hover-wash)] transition-colors",
          )}
        >
          {count} {count === 1 ? "cell" : "cells"}
        </button>
      </Tooltip>
      {states.errored && (
        <Tooltip content="Has errors" delayDuration={100}>
          <AlertOctagonIcon className="w-3.5 h-3.5 shrink-0 text-destructive" />
        </Tooltip>
      )}
      {states.stale && (
        <Tooltip content="Has stale cells" delayDuration={100}>
          <RefreshCcw className="w-3.5 h-3.5 shrink-0 text-(--yellow-11)" />
        </Tooltip>
      )}
      {states.runningOrQueued && (
        <Tooltip content="Running" delayDuration={100}>
          <Loader2Icon className="w-3.5 h-3.5 shrink-0 animate-spin" />
        </Tooltip>
      )}
    </div>
  );
});
CollapsedCellBanner.displayName = "CollapsedCellBanner";
