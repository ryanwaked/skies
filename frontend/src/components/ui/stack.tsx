/* Copyright 2026 Marimo. All rights reserved. */

import * as React from "react";
import { cn } from "@/utils/cn";

/**
 * Layout primitives for consistent vertical and horizontal rhythm.
 *
 * Prefer these over ad-hoc `<div className="flex flex-col gap-2">` so spacing
 * stays on the design system's scale. `gap` is typed to the spacing values the
 * design language actually uses; pass `gap={undefined}` and set `className`
 * for anything custom.
 */

// Static map so Tailwind's JIT can see the gap utilities at build time
// (dynamic `gap-${n}` strings would be invisible to the scanner).
const gapClass = {
  "0": "gap-0",
  "1": "gap-1",
  "1.5": "gap-1.5",
  "2": "gap-2",
  "3": "gap-3",
  "4": "gap-4",
  "6": "gap-6",
  "8": "gap-8",
} as const;

export type StackGap = keyof typeof gapClass;

export type StackProps = React.HTMLAttributes<HTMLDivElement> & {
  gap?: StackGap;
};

/**
 * Vertical stack. Lays children out top-to-bottom with a consistent gap.
 */
export const VStack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ className, gap = "2", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col", gapClass[gap], className)}
      {...props}
    />
  ),
);
VStack.displayName = "VStack";

/**
 * Horizontal stack. Lays children out left-to-right, centered on the
 * cross-axis, with a consistent gap.
 */
export const HStack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ className, gap = "2", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-row items-center", gapClass[gap], className)}
      {...props}
    />
  ),
);
HStack.displayName = "HStack";
