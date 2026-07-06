/* Copyright 2026 Marimo. All rights reserved. */

import type React from "react";
import { useEffect, useState } from "react";

/**
 * Track a container's width as coarse buckets, so the list table can drop
 * columns as the pane narrows (rather than overflowing). "wide" shows all
 * columns, "mid" hides the path column, "narrow" hides path + cells.
 */
export type PaneWidth = "wide" | "mid" | "narrow";

export function useContainerWidth<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  { mid = 720, narrow = 560 }: { mid?: number; narrow?: number } = {},
): PaneWidth {
  const [bucket, setBucket] = useState<PaneWidth>("wide");

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const measure = (width: number) => {
      setBucket(width < narrow ? "narrow" : width < mid ? "mid" : "wide");
    };
    // Read the same box (clientWidth) on the initial measure and on every
    // resize, so the two paths never disagree by the container's padding.
    measure(el.clientWidth);

    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      measure(el.clientWidth);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, mid, narrow]);

  return bucket;
}
