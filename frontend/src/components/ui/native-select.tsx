/* Copyright 2026 Marimo. All rights reserved. */

import { cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/utils/cn";
import { Events } from "@/utils/events";
import { focusRing } from "./styles";

export const selectStyles = cva(
  cn(
    "flex h-6 w-fit mb-1 items-center justify-between rounded-sm bg-background px-2 text-sm font-prose placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
    focusRing,
  ),
  {
    variants: {
      variant: {
        default: "border border-input focus:border-primary",
        ghost: "opacity-70 hover:opacity-100 focus:opacity-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.InputHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    onClick={Events.stopPropagation()}
    className={cn(selectStyles({}), className)}
    {...props}
  >
    {children}
  </select>
));
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
