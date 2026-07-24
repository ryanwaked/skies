/* Copyright 2026 Marimo. All rights reserved. */

import { useAtom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { DatabaseIcon, VariableIcon } from "lucide-react";
import React, { useCallback } from "react";
import {
  connectionsAtom,
  DataSources,
} from "@/components/datasources/datasources";
import { VariableTable } from "@/components/variables/variables-table";
import { useCellIds } from "@/core/cells/cells";
import { datasetTablesAtom } from "@/core/datasets/state";
import { useVariables } from "@/core/variables/state";
import { jotaiJsonStorage } from "@/utils/storage/jotai";
import { PanelBadge, ResizablePanelSections } from "./components";
import { PanelEmptyState } from "./empty-state";

type OpenSections = "variables" | "datasources";

interface SessionPanelState {
  openSections: OpenSections[];
  hasUserInteracted: boolean;
}

const sessionPanelAtom = atomWithStorage<SessionPanelState>(
  "marimo:session-panel:state",
  { openSections: ["variables"], hasUserInteracted: false },
  jotaiJsonStorage,
);

const SessionPanel: React.FC = () => {
  const variables = useVariables();
  const cellIds = useCellIds();
  const tables = useAtomValue(datasetTablesAtom);
  const dataConnections = useAtomValue(connectionsAtom);
  const [state, setState] = useAtom(sessionPanelAtom);

  const datasourcesCount = tables.length + dataConnections.length;

  // If the user hasn't interacted with the accordion and there are connections, show datasources open
  const openSections =
    !state.hasUserInteracted && datasourcesCount > 0
      ? [...new Set([...state.openSections, "datasources"])]
      : state.openSections;

  const handleOpenSectionsChange = useCallback(
    (open: string[]) => {
      setState({
        openSections: open as OpenSections[],
        hasUserInteracted: true,
      });
    },
    [setState],
  );

  const isDatasourcesOpen = openSections.includes("datasources");
  const showDatasourcesBadge = !isDatasourcesOpen && datasourcesCount > 0;

  return (
    <ResizablePanelSections
      storageKey="session"
      sections={[
        {
          id: "datasources",
          header: (
            <>
              <DatabaseIcon className="w-3 h-3" strokeWidth={1.5} />
              Data sources
              {showDatasourcesBadge && (
                <PanelBadge>{datasourcesCount}</PanelBadge>
              )}
            </>
          ),
          content: (
            <div className="h-full overflow-y-auto overflow-x-hidden">
              <DataSources />
            </div>
          ),
        },
        {
          id: "variables",
          header: (
            <>
              <VariableIcon className="w-3 h-3" strokeWidth={1.5} />
              Variables
            </>
          ),
          content: (
            <div className="h-full overflow-y-auto overflow-x-hidden">
              {Object.keys(variables).length === 0 ? (
                <PanelEmptyState
                  title="No variables"
                  description="Variables defined in your notebook appear here."
                  icon={<VariableIcon />}
                />
              ) : (
                <VariableTable
                  cellIds={cellIds.inOrderIds}
                  variables={variables}
                />
              )}
            </div>
          ),
        },
      ]}
      openSections={openSections}
      onOpenSectionsChange={handleOpenSectionsChange}
    />
  );
};

export default SessionPanel;
