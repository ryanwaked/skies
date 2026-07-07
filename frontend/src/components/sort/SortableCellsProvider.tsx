/* Copyright 2026 Marimo. All rights reserved. */

import {
  type AutoScrollOptions,
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  getFirstCollision,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import React, { useCallback, useMemo, useRef, useState } from "react";
import type { CellId } from "@/core/cells/ids";
import {
  cellSectionsAtom,
  getSectionInfo,
} from "@/core/cells/sections";
import { useAppConfig } from "@/core/config/config";
import { store } from "@/core/state/jotai";
import { Arrays } from "@/utils/arrays";
import type { CellColumnId, MultiColumn } from "@/utils/id-tree";
import { invariant } from "@/utils/invariant";
import { getNotebook, useCellActions } from "../../core/cells/cells";
import { useEvent } from "../../hooks/useEvent";

interface SortableCellsProviderProps {
  multiColumn: boolean;
  children: React.ReactNode;
}

// autoScroll threshold x: 0 is required to disable horizontal scroll
//            threshold y: 0.1 means scroll y when near bottom/top 10% of
//            scrollable container
const autoScroll: AutoScrollOptions = {
  threshold: { x: 0, y: 0.1 },
};

const SortableCellsProviderInternal = ({
  children,
  multiColumn,
}: SortableCellsProviderProps) => {
  const {
    dropCellOverCell,
    dropCellOverColumn,
    moveColumn,
    compactColumns,
    moveCellsRelativeTo,
  } = useCellActions();

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  // When a section heading is being dragged, the ids of the whole section
  // (head + the cells beneath it) so they move together on drop.
  const sectionMembersRef = useRef<CellId[] | null>(null);
  const [clonedItems, setClonedItems] = useState<MultiColumn<CellId> | null>(
    null,
  );

  const [config] = useAppConfig();
  const modifiers = useMemo(() => {
    if (config.width === "columns") {
      return Arrays.EMPTY;
    }
    return [restrictToVerticalAxis];
  }, [config.width]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // to support click and drag on the same element
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = useEvent((event: DragStartEvent) => {
    setActiveId(event.active.id);
    const notebook = getNotebook();
    setClonedItems(notebook.cellIds);
    // If a section heading is being dragged, remember its member cells so the
    // whole section moves as a group when dropped (see handleDragEnd).
    sectionMembersRef.current = getDraggedSectionMembers(
      notebook.cellIds,
      event.active.id,
    );
  });

  const handleDragCancel = useEvent(() => {
    // TODO: restore cloned items
    if (clonedItems) {
      // Reset items to their original state in case items have been
      // Dragged across containers
      // setItems(clonedItems);
    }

    setActiveId(null);
    setClonedItems(null);
    sectionMembersRef.current = null;
  });

  /**
   * Custom collision detection:
   * 1. If dragging a column, we can only drop on other columns
   *  - We just use closestCenter
   *  - We filter the droppableContainers to only consider other columns
   * 2. If dragging a cell, we want to find the best column to drop on
   *  - We get the first intersection
   *  - Find the closest column to the cell
   *  - If the column is empty, we consider it a valid drop target
   *  - Otherwise, we only consider the cells in the same column
   */
  const collisionDetectionStrategy = useCallback(
    (args: Parameters<CollisionDetection>[0]) => {
      const columnContainers = args.droppableContainers.filter((container) =>
        isColumnId(container.id),
      );

      // 1. Handle column dragging
      if (activeId && isColumnId(activeId)) {
        return closestCenter({
          ...args,
          droppableContainers: columnContainers,
        });
      }

      // 2. Handle cell dragging

      // Get the first column intersection
      const pointerIntersections = pointerWithin({
        ...args,
        droppableContainers: columnContainers,
      });
      const intersections =
        pointerIntersections.length > 0
          ? pointerIntersections
          : rectIntersection({
              ...args,
              droppableContainers: columnContainers,
            });
      const overId = getFirstCollision(intersections, "id");
      if (!overId) {
        return [];
      }
      invariant(isColumnId(overId), `Expected column id. Got: ${overId}`);

      // If column is empty, we can drop on it
      const notebook = getNotebook();
      const column = notebook.cellIds.get(overId);
      invariant(column, `Expected column. Got: ${overId}`);
      if (column && column.topLevelIds.length === 0) {
        // Return the column
        return [{ id: overId }];
      }

      // If the column is not empty, we only consider the cells in the same column
      const cellIdSet = new Set(column.topLevelIds);
      const collisions = closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (container) =>
            container.id !== overId && cellIdSet.has(container.id as CellId),
        ),
      });

      if (collisions.length > 0) {
        const overId = collisions[0].id;
        invariant(isCellId(overId), `Expected cell id. Got: ${overId}`);
        // Return the cell
        return [{ id: overId }];
      }

      return [];
    },
    [activeId],
  );

  const handleDragOver = useEvent(({ active, over }) => {
    const overId = over?.id;

    if (overId == null || active.id === overId) {
      return;
    }

    // A section moves as a group only on drop, so don't live-reorder its
    // heading cell-by-cell here.
    if (sectionMembersRef.current) {
      return;
    }

    // Handle moving cells
    if (isCellId(active.id)) {
      // Moving a cell to a column
      if (isColumnId(overId)) {
        dropCellOverColumn({
          cellId: active.id,
          columnId: overId,
        });
        return;
      }

      // Moving a cell above another cell
      if (isCellId(overId)) {
        dropCellOverCell({
          cellId: active.id,
          overCellId: overId,
        });
        return;
      }
    }

    // Moving a column to another column
    if (isColumnId(active.id) && isColumnId(overId)) {
      moveColumn({
        column: active.id,
        overColumn: overId,
      });
    }
  });

  const handleDragEnd = useEvent((event: DragEndEvent) => {
    const { active, over } = event;
    const sectionMembers = sectionMembersRef.current;
    sectionMembersRef.current = null;

    if (over === null || active.id === over.id) {
      return;
    }

    // Move a dragged section (its heading + all cells beneath it) as a group.
    if (sectionMembers && isCellId(over.id)) {
      const position = getSectionDropPosition(sectionMembers, over.id);
      if (position) {
        moveCellsRelativeTo({
          cellIds: sectionMembers,
          targetCellId: over.id,
          position,
        });
      }
    }

    compactColumns();
  });

  return (
    <DndContext
      autoScroll={autoScroll}
      sensors={sensors}
      // For single-column, we just do closestCenter
      collisionDetection={
        multiColumn ? collisionDetectionStrategy : closestCenter
      }
      modifiers={modifiers}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragOver={handleDragOver}
    >
      {children}
    </DndContext>
  );
};

export const SortableCellsProvider = React.memo(SortableCellsProviderInternal);

/**
 * When `activeId` is a section heading, the ids of the whole section (the head
 * plus every top-level cell beneath it, in order) so they can be dragged as a
 * unit. Returns `null` for non-heads and lone headings (nothing extra to move,
 * so they drag like a normal single cell).
 */
function getDraggedSectionMembers(
  cellIds: MultiColumn<CellId>,
  activeId: UniqueIdentifier,
): CellId[] | null {
  if (!isCellId(activeId)) {
    return null;
  }
  const info = getSectionInfo(store.get(cellSectionsAtom), activeId);
  if (!info.isSectionHead || info.lastCellId == null) {
    return null;
  }
  const topLevel = cellIds.findWithId(activeId).topLevelIds;
  const start = topLevel.indexOf(activeId);
  const end = topLevel.indexOf(info.lastCellId);
  if (start === -1 || end <= start) {
    return null;
  }
  return topLevel.slice(start, end + 1);
}

/**
 * Where to drop a dragged section relative to the cell under the cursor:
 * before it if the target sits above the section, after it otherwise. `null`
 * when the target is one of the section's own cells (a no-op).
 */
function getSectionDropPosition(
  members: CellId[],
  overId: CellId,
): "before" | "after" | null {
  if (members.includes(overId)) {
    return null;
  }
  const cellIds = getNotebook().cellIds;
  const headId = members[0];
  const headColumn = cellIds.findWithId(headId);
  const overColumn = cellIds.findWithId(overId);
  // Different column: insert before the target.
  if (headColumn.id !== overColumn.id) {
    return "before";
  }
  const topLevel = headColumn.topLevelIds;
  const overIdx = topLevel.indexOf(overId);
  const headIdx = topLevel.indexOf(headId);
  if (overIdx === -1 || headIdx === -1) {
    return "before";
  }
  return overIdx < headIdx ? "before" : "after";
}

function isCellId(id: UniqueIdentifier): id is CellId {
  return typeof id === "string" && !id.startsWith("tree_");
}

function isColumnId(id: UniqueIdentifier): id is CellColumnId {
  return typeof id === "string" && id.startsWith("tree_");
}
