/* Copyright 2026 Marimo. All rights reserved. */
import { asURL } from "./url";

/**
 * Open a notebook in a new tab.
 * @param path - The path to the notebook.
 */
export function openNotebook(path: string) {
  // There is no leading `/` in the path in order to work when marimo is at a subpath.
  window.open(asURL(`?file=${encodeURIComponent(path)}`).toString(), "_blank");
}

/**
 * Open a notebook in the current tab.
 *
 * Used when switching between notebooks within the same project. The current
 * `mode` query param (if present) is preserved so a notebook opened in run
 * mode keeps switching in run mode.
 *
 * Unsaved-changes safety: there is no synchronous "flush" hook outside of the
 * React save machinery (`useSaveNotebook`), so we rely on the existing
 * autosave loop and the `beforeunload` guard registered by the save
 * component, which blocks navigation while the notebook has unsaved changes.
 *
 * @param path - The path to the notebook.
 * @param sessionId - Optional session id of a running notebook, so the
 *   backend can warm-resume the existing session instead of spawning a new
 *   kernel.
 */
export function openNotebookInCurrentTab(path: string, sessionId?: string) {
  // There is no leading `/` in the path in order to work when marimo is at a subpath.
  const url = asURL(`?file=${encodeURIComponent(path)}`);
  // Preserve benign params from the current URL that should survive a
  // notebook switch.
  const currentParams = new URLSearchParams(window.location.search);
  const mode = currentParams.get("mode");
  if (mode) {
    url.searchParams.set("mode", mode);
  }
  if (sessionId) {
    url.searchParams.set("session_id", sessionId);
  }
  window.location.assign(url.toString());
}
