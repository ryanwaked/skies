/* Copyright 2026 Marimo. All rights reserved. */

import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import { Toolbar as ReactAriaToolbar } from "react-aria-components";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/utils/cn";
import { Events } from "@/utils/events";

const toolbarItemVariants = cva(
  "rounded-[3px] border p-[5px] transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 [&>svg]:size-3 bg-background",
  {
    variants: {
      variant: {
        default: "hover:bg-accent hover:text-accent-foreground",
        stale: "bg-action hover:bg-action-hover text-action-foreground",
        green:
          "hover:bg-[rgba(67,213,157,0.12)] hover:text-(--success) hover:border-[rgba(67,213,157,0.4)]",
        disabled: "opacity-50 cursor-not-allowed",
        danger: "hover:bg-[rgba(237,111,115,0.12)] hover:text-(--error)",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface ToolbarItemProps
  extends
    VariantProps<typeof toolbarItemVariants>,
    React.HTMLAttributes<HTMLButtonElement> {
  tooltip: React.ReactNode;
  disabled?: boolean;
}

export const ToolbarItem: React.FC<ToolbarItemProps> = ({
  children,
  tooltip,
  disabled = false,
  variant,
  ...rest
}) => {
  const content = (
    <button
      disabled={disabled}
      {...rest}
      onClick={(evt) => {
        if (!disabled) {
          rest.onClick?.(evt);
        }
      }}
      // Prevent focus on the toolbar after clicking
      onMouseDown={Events.preventFocus}
      className={cn(toolbarItemVariants({ variant }), rest.className)}
    >
      {children}
    </button>
  );

  if (tooltip) {
    return (
      <Tooltip
        content={tooltip}
        side="top"
        delayDuration={200}
        usePortal={false}
      >
        {content}
      </Tooltip>
    );
  }
  return content;
};

interface ToolbarProps {
  className?: string;
  children: React.ReactNode;
}

export const Toolbar: React.FC<ToolbarProps> = ({ children, className }) => (
  <ReactAriaToolbar
    className={cn(
      "flex items-center gap-1 bg-background m-[2px] rounded-full",
      className,
    )}
  >
    {children}
  </ReactAriaToolbar>
);
