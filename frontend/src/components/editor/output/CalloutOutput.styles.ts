/* Copyright 2026 Marimo. All rights reserved. */
import { cva } from "class-variance-authority";

// Skies callout surfaces: raised popover background, semantic 40% borders and
// semantic text. Flat (no shadows), 3px radius via the global --radius.
export const calloutStyles = cva("border rounded-lg p-12 mt-12 mb-12", {
  variants: {
    kind: {
      neutral: "bg-popover border-border text-foreground",
      // @deprecated, use danger instead
      alert: "bg-popover border-error/40 text-error",
      info: "bg-popover border-link/40 text-link",
      danger: "bg-popover border-error/40 text-error",
      warn: "bg-popover border-action-foreground/40 text-action-foreground",
      success: "bg-popover border-success/40 text-success",
    },
  },
  defaultVariants: {
    kind: "neutral",
  },
});
