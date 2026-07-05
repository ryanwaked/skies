/* Copyright 2026 Marimo. All rights reserved. */
import React from "react";

interface Props {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactElement<{ className?: string; strokeWidth?: number }>;
  action?: React.ReactNode;
}

/**
 * Skies panel empty state: centered, muted 12px text with a thin icon.
 */
export const PanelEmptyState = ({
  title,
  description,
  icon,
  action,
}: Props) => {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-10 text-center">
      {icon &&
        // oxlint-disable-next-line react/no-clone-element
        React.cloneElement(icon, {
          className: "h-4 w-4 shrink-0 text-muted-foreground",
          strokeWidth: 1.5,
        })}
      {title && (
        <span className="text-[13px] font-medium text-muted-foreground">
          {title}
        </span>
      )}
      {description && (
        <span className="text-[13px] leading-5 text-muted-foreground max-w-[260px]">
          {description}
        </span>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};
