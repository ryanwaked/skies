/* Copyright 2026 Marimo. All rights reserved. */

import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircleIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { cn } from "@/utils/cn";

const spinnerVariants = cva("animate-spin", {
  variants: {
    centered: {
      // Auto-centers within a relative parent.
      true: "m-auto",
      // Marker only — the full-height wrapper is rendered by Spinner.
      full: "",
    },
    size: {
      small: "size-4",
      medium: "size-12",
      large: "size-20",
      xlarge: "size-20",
    },
  },
  defaultVariants: {
    size: "medium",
  },
});

export interface SpinnerProps
  extends
    Omit<React.SVGProps<SVGSVGElement>, "title">,
    VariantProps<typeof spinnerVariants> {
  /**
   * When set, renders a cross-fading caption beneath the spinner. Implies
   * `centered="full"` (a full-height flex column) so the pair reads as a
   * top-level loading screen — the use case this serves (e.g. WASM boot).
   */
  title?: string;
}

/**
 * The canonical Skies spinner. Uses `LoaderCircleIcon` (the same glyph as the
 * Run-all button) at `strokeWidth: 1.5` for a consistent spinning idiom.
 *
 * - `size`: small (16) / medium (48) / large·xlarge (80).
 * - `centered="true"`: auto-centers within a relative parent.
 * - `centered="full"` or `title`: full-height flex column, with an optional
 *   fading caption.
 */
const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ className, centered, size, title, ...props }, ref) => {
    const icon = (
      <LoaderCircleIcon
        ref={ref}
        className={cn(spinnerVariants({ centered, size }), className)}
        strokeWidth={1.5}
        data-testid={title ? "large-spinner" : undefined}
        {...props}
      />
    );

    if (centered === "full" || title !== undefined) {
      return (
        <div className="flex flex-col h-full flex-1 items-center justify-center p-4">
          {icon}
          {title !== undefined ? <Caption title={title} /> : null}
        </div>
      );
    }

    return icon;
  },
);
Spinner.displayName = "Spinner";

export { Spinner };

/**
 * A fading caption that cross-fades when the `title` changes (300ms), so the
 * loading screen can cycle through status messages without a hard cut.
 */
const Caption: React.FC<{ title: string }> = ({ title }) => {
  const [currentTitle, setCurrentTitle] = useState(title);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (title !== currentTitle) {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setCurrentTitle(title);
        setIsVisible(true);
      }, 300); // Wait for fade out animation to complete
      return () => clearTimeout(timer);
    }
  }, [title, currentTitle]);

  return (
    <div
      className={cn(
        "mt-2 text-muted-foreground font-semibold text-lg transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0",
      )}
    >
      {currentTitle}
    </div>
  );
};
