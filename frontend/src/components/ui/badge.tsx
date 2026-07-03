/* Copyright 2026 Marimo. All rights reserved. */

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center border rounded-full px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary/10 hover:bg-primary/20 border-transparent text-primary",
        defaultOutline: "bg-link/10 border-link/40 text-link",
        secondary:
          "bg-secondary hover:bg-secondary/80 border-transparent text-secondary-foreground",
        destructive:
          "bg-error/10 border-error/40 text-error hover:bg-error/15",
        success:
          "bg-success/10 border-success/40 text-success hover:bg-success/15",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = ({ className, variant, ...props }: BadgeProps) => {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
};

export { Badge, badgeVariants };
