/* Copyright 2026 Marimo. All rights reserved. */
import { asURL } from "./url";

/**
 * Class applied to `<html>` while a same-tab notebook navigation is in
 * flight. Paired with `css/app/page-transitions.css`, which dims the live
 * page and animates the cross-document View Transition snapshots.
 */
export const PAGE_EXIT_CLASS = "marimo-page-exit";

/**
 * Fallback lifetime of {@link PAGE_EXIT_CLASS}. If navigation is cancelled
 * by the `beforeunload` unsaved-changes guard, the dim is removed so the
 * page is not stuck half-transparent. On a successful navigation the page
 * unloads long before this fires and the timer dies with it.
 */
const PAGE_EXIT_FALLBACK_MS = 1500;

function prefersReducedMotion(): boolean {
  // `matchMedia` is not implemented in every environment (e.g. jsdom);
  // treat its absence as "no preference" — the CSS is media-gated anyway.
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

/**
 * Visually dim the app before a hard in-tab navigation so the switch reads
 * as a content morph rather than a white flash.
 *
 * Browsers with cross-document View Transitions (opted in via
 * `@view-transition { navigation: auto }` in `page-transitions.css`)
 * capture this dimmed state into the outgoing snapshot and morph it into
 * the incoming page; elsewhere the dim simply softens the cut. No-op when
 * the user prefers reduced motion.
 */
export function preparePageExitTransition(): void {
  if (prefersReducedMotion()) {
    return;
  }
  const root = document.documentElement;
  root.classList.add(PAGE_EXIT_CLASS);
  window.setTimeout(
    () => root.classList.remove(PAGE_EXIT_CLASS),
    PAGE_EXIT_FALLBACK_MS,
  );
}

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
  preparePageExitTransition();
  window.location.assign(url.toString());
}
