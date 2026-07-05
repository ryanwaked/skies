/* Copyright 2026 Marimo. All rights reserved. */

import type React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCellDataAtoms, useCellIds } from "@/core/cells/cells";
import { useVariables } from "@/core/variables/state";
import { cn } from "@/utils/cn";
import { DependencyGraph } from "../../../dependency-graph/dependency-graph";
import { MinimapContent } from "../../../dependency-graph/minimap-content";
import { useDependencyPanelTab } from "../wrapper/useDependencyPanelTab";

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
      <div className="p-2 border-b border-border shrink-0">
        <Tabs
          value={dependencyPanelTab}
          onValueChange={(value) => {
            if (value === "minimap" || value === "graph") {
              setDependencyPanelTab(value);
            }
          }}
        >
          <TabsList>
            <TabsTrigger
              value="minimap"
              className="py-0.5 text-xs font-medium rounded-[3px]"
            >
              Minimap
            </TabsTrigger>
            <TabsTrigger
              value="graph"
              className="py-0.5 text-xs font-medium rounded-[3px]"
            >
              Graph
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
