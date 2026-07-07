/* Copyright 2026 Marimo. All rights reserved. */
import type { PropsWithChildren } from "react";
import type { AppConfig } from "@/core/config/config-schema";
import { cn } from "@/utils/cn";

interface Props {
  className?: string;
  innerClassName?: string;
  appConfig: AppConfig;
  invisible?: boolean;
}

export const VerticalLayoutWrapper: React.FC<PropsWithChildren<Props>> = ({
  invisible,
  appConfig,
  className,
  children,
  innerClassName,
}) => {
  return (
    <div
      className={cn(
        // Hex gutter: 40px, not marimo's 64-96px staircase — the column
        // token (--content-width-medium) owns the measure, gutters are
        // just breathing room against the panels.
        "px-1 sm:px-10 print:px-0 print:pb-0",
        // Large mobile bottom padding due to mobile browser navigation bar
        "pb-24 sm:pb-12",
        // In full width the content otherwise runs right under the floating
        // table of contents pinned to the right edge; reserve room for it on
        // wider screens (where the TOC is shown).
        appConfig.width === "full" && "md:pr-16 lg:pr-24",
        className,
      )}
    >
      <div
        className={cn(
          "m-auto",
          appConfig.width === "compact" &&
            "max-w-(--content-width) sm:min-w-[400px]",
          appConfig.width === "medium" &&
            "max-w-(--content-width-medium) sm:min-w-[400px]",
          appConfig.width === "columns" && "w-fit",
          appConfig.width === "full" && "max-w-full",
          // Hide the cells for a fake loading effect, to avoid flickering
          invisible && "invisible",
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
};
