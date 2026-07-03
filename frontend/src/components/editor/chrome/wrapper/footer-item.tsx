/* Copyright 2026 Marimo. All rights reserved. */

import type React from "react";
import { forwardRef } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/utils/cn";

type FooterItemProps = {
  selected: boolean;
  tooltip: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export const FooterItem: React.FC<FooterItemProps> = forwardRef<
  HTMLDivElement,
  FooterItemProps
>(({ children, tooltip, selected, className, ...rest }, ref) => {
  const content = (
    <div
      ref={ref}
      className={cn(
        "h-full flex items-center p-2 text-sm cursor-pointer rounded-sm",
        !selected && "hover:bg-[rgba(63,66,87,0.2)]",
        selected && "bg-primary/7 text-primary",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} side="top" delayDuration={200}>
        {content}
      </Tooltip>
    );
  }

  return content;
});

FooterItem.displayName = "FooterItem";
