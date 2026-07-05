/* Copyright 2026 Marimo. All rights reserved. */

import type React from "react";
import type { PropsWithChildren } from "react";
import type { AppConfig } from "@/core/config/config-schema";
import { PyodideLoader } from "@/core/wasm/PyodideLoader";
import { isAppClosed } from "@/core/websocket/connection-utils";
import type { ConnectionStatus } from "@/core/websocket/types";
import { cn } from "@/utils/cn";
import { DynamicFavicon } from "./dynamic-favicon";
import { StatusOverlay } from "./header/status";
import { WrappedWithSidebar } from "./renderers/vertical-layout/sidebar/wrapped-with-sidebar";

interface Props {
  connection: ConnectionStatus;
  isRunning: boolean;
  width: AppConfig["width"];
  onReconnect?: () => void;
  /**
   * Hide the floating "running" icon; used when the notebook header bar
   * already renders an inline status indicator.
   */
  hideRunningIndicator?: boolean;
}

export const AppContainer: React.FC<PropsWithChildren<Props>> = ({
  width,
  connection,
  isRunning,
  children,
  onReconnect,
  hideRunningIndicator,
}) => {
  const connectionState = connection.state;

  return (
    <>
      <DynamicFavicon isRunning={isRunning} />
      <StatusOverlay
        connection={connection}
        isRunning={isRunning}
        onReconnect={onReconnect}
        hideRunningIndicator={hideRunningIndicator}
      />
      <PyodideLoader>
        <WrappedWithSidebar>
          {/** oxlint-ignore-next-line -- ID is used by other components to grab the DOM element */}
          <div
            id="App"
            data-config-width={width}
            data-connection-state={connectionState}
            className={cn(
              "mathjax_ignore",
              isAppClosed(connectionState) && "disconnected",
              // skies-desk: the grid-and-grain desk shows behind the cell
              // "papers" (fixed-attachment, so it holds still while they scroll)
              "skies-desk w-full h-full text-textColor",
              "flex flex-col overflow-y-auto",
              width === "full" && "config-width-full",
              width === "columns"
                ? "overflow-x-auto"
                : "overflow-x-auto sm:overflow-x-hidden",
              "print:height-fit",
            )}
          >
            {children}
          </div>
        </WrappedWithSidebar>
      </PyodideLoader>
    </>
  );
};
