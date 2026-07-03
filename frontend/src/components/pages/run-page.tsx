/* Copyright 2026 Marimo. All rights reserved. */

import { Panel, PanelGroup } from "react-resizable-panels";
import type { AppConfig } from "@/core/config/config-schema";
import { RunApp } from "@/core/run-app";
import { ContextAwarePanel } from "../editor/chrome/panels/context-aware-panel/context-aware-panel";
import { PanelsWrapper } from "../editor/chrome/wrapper/panels";
import { StaticBanner } from "../static-html/static-banner";

interface Props {
  appConfig: AppConfig;
}

const RunPage = (props: Props) => {
  return (
    <PanelsWrapper>
      <PanelGroup direction="horizontal" autoSaveId="marimo:chrome:v1:run1">
        <Panel>
          <StaticBanner />
          <RunApp appConfig={props.appConfig} />
        </Panel>
        <ContextAwarePanel />
      </PanelGroup>
    </PanelsWrapper>
  );
};

export default RunPage;
