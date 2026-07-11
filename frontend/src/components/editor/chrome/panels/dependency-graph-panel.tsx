/* Copyright 2026 Marimo. All rights reserved. */

import type React from "react";
import { useCellDataAtoms, useCellIds } from "@/core/cells/cells";
import { useVariables } from "@/core/variables/state";
import { cn } from "@/utils/cn";
import { DependencyGraph } from "../../../dependency-graph/dependency-graph";
import { MinimapContent } from "../../../dependency-graph/minimap-content";
import { useDependencyPanelTab } from "../wrapper/useDependencyPanelTab";
import {
  PANEL_SEGMENTED_ITEM,
  PANEL_SEGMENTED_ITEM_ACTIVE,
  PANEL_SEGMENTED_ITEM_INACTIVE,
  PANEL_TOOLBAR_ROW,
} from "./panel-styles";

const TABS = [
  { value: "minimap", label: "Minimap" },
  { value: "graph", label: "Graph" },
] as const;

const DependencyGraphPanel: React.FC = () => {
  const { dependencyPanelTab, setDependencyPanelTab } = useDependencyPanelTab();
  const variables = useVariables();
  const cellIds = useCellIds();
  const [cells] = useCellDataAtoms();

  return (
    <div className={cn("w-full h-full flex-1 mx-auto -mb-4 flex flex-col")}>
      {/* Skies: the Minimap/Graph switch lives in its own toolbar row inside
          the panel body — the 30px panel header (shared with every other
          sidebar panel) is too cramped to also host a tab control. */}
      <div className={PANEL_TOOLBAR_ROW}>
        <div className="flex gap-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setDependencyPanelTab(tab.value)}
              className={cn(
                PANEL_SEGMENTED_ITEM,
                dependencyPanelTab === tab.value
                  ? PANEL_SEGMENTED_ITEM_ACTIVE
                  : PANEL_SEGMENTED_ITEM_INACTIVE,
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        {dependencyPanelTab === "minimap" ? (
          <MinimapContent />
        ) : (
          <DependencyGraph
            cellAtoms={cells}
            variables={variables}
            cellIds={cellIds.inOrderIds}
          />
        )}
      </div>
    </div>
  );
};

export default DependencyGraphPanel;
