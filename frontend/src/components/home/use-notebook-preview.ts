/* Copyright 2026 Marimo. All rights reserved. */

import type React from "react";
import { useEffect, useState } from "react";
import { getRequestClient } from "@/core/network/requests";
import type { NotebookPreviewResponse } from "@/core/network/types";

/**
 * Lazily fetch a notebook's structural preview when its card nears the
 * viewport, and cache the result by path.
 *
 * The cache is keyed by PATH ONLY, so the home page's 10s running-poll
 * re-render (which bumps a nonce) never re-triggers a fetch — previews are
 * loaded at most once per notebook per session, no matter how often the grid
 * re-renders.
 */

export type PreviewStatus = "idle" | "loading" | "ready" | "error";

// Successful previews only; errors stay transient so a refresh can retry.
const cache = new Map<string, NotebookPreviewResponse>();
const inflight = new Map<string, Promise<NotebookPreviewResponse>>();

function fetchPreview(path: string): Promise<NotebookPreviewResponse> {
  const cached = cache.get(path);
  if (cached) {
    return Promise.resolve(cached);
  }
  const existing = inflight.get(path);
  if (existing) {
    return existing;
  }
  const promise = getRequestClient()
    .getNotebookPreview({ file: path })
    .then((res) => {
      cache.set(path, res);
      inflight.delete(path);
      return res;
    })
    .catch((err) => {
      inflight.delete(path);
      throw err;
    });
  inflight.set(path, promise);
  return promise;
}

export function useNotebookPreview<T extends HTMLElement>(
  path: string,
  ref: React.RefObject<T | null>,
): { preview: NotebookPreviewResponse | null; status: PreviewStatus } {
  const [preview, setPreview] = useState<NotebookPreviewResponse | null>(
    () => cache.get(path) ?? null,
  );
  const [status, setStatus] = useState<PreviewStatus>(() =>
    cache.has(path) ? "ready" : "idle",
  );

  useEffect(() => {
    const cached = cache.get(path);
    if (cached) {
      setPreview(cached);
      setStatus("ready");
      return;
    }
    setPreview(null);
    setStatus("idle");

    let cancelled = false;
    let started = false;
    const start = () => {
      if (started) {
        return;
      }
      started = true;
      setStatus("loading");
      fetchPreview(path)
        .then((res) => {
          if (!cancelled) {
            setPreview(res);
            setStatus("ready");
          }
        })
        .catch(() => {
          if (!cancelled) {
            setStatus("error");
          }
        });
    };

    const el = ref.current;
    // Without an element or IntersectionObserver (e.g. tests), fetch eagerly.
    if (!el || typeof IntersectionObserver === "undefined") {
      start();
      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          start();
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [path, ref]);

  return { preview, status };
}
