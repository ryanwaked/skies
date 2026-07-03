/* Copyright 2026 Marimo. All rights reserved. */

import { ChartPieIcon, Loader2 } from "lucide-react";
import { ErrorBanner } from "@/plugins/impl/common/error-banner";
import { cn } from "@/utils/cn";

export const ChartLoadingState: React.FC = () => (
  <div className="flex h-full min-h-32 items-center gap-2 justify-center text-muted-foreground">
    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
    <span className="text-xs">Loading chart...</span>
  </div>
);

export const ChartErrorState: React.FC<{ error: Error }> = ({ error }) => (
  <div className="flex items-center justify-center">
    <ErrorBanner error={error} />
  </div>
);

export const ChartInfoState: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        className,
      )}
    >
      <ChartPieIcon
        className="w-8 h-8 text-muted-foreground"
        strokeWidth={1.5}
      />
      <span className="text-xs text-muted-foreground">{children}</span>
    </div>
  );
};
