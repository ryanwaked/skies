/* Copyright 2026 Marimo. All rights reserved. */
import React from "react";

interface Props {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactElement<{ className?: string }>;
  action?: React.ReactNode;
}

export const PanelEmptyState = ({
  title,
  description,
  icon,
  action,
}: Props) => {
  return (
    <div className="mx-6 my-6 flex flex-col gap-2">
      <div className="flex flex-row gap-2 items-center">
        {icon &&
          // oxlint-disable-next-line react/no-clone-element
          React.cloneElement(icon, {
            className: "text-accent-foreground shrink-0",
          })}
        <span className="mt-1 text-accent-foreground">{title}</span>
      </div>
      {/* Hex help text: 12px/16px, muted */}
      <span className="text-muted-foreground text-xs leading-4">
        {description}
      </span>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};
