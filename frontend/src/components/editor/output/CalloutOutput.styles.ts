/* Copyright 2026 Marimo. All rights reserved. */
import { cva } from "class-variance-authority";

export const calloutStyles = cva(
  "border rounded-lg p-12 mt-12 mb-12 text-foreground",
  {
    variants: {
      kind: {
        neutral: "border-border bg-card",
        // @deprecated, use danger instead
        alert: "bg-error/8 border-error/40",
        info: "bg-link/8 border-link/40",
        danger: "bg-error/8 border-error/40",
        warn: "bg-action border-action-foreground/40",
        success: "bg-success/8 border-success/40",
      },
    },
    defaultVariants: {
      kind: "neutral",
    },
  },
);
