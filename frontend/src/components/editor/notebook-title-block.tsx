/* Copyright 2026 Marimo. All rights reserved. */

import { useCellIds } from "@/core/cells/cells";
import type { AppConfig } from "@/core/config/config-schema";
import { useFilename } from "@/core/saving/filename";
import { Paths } from "@/utils/paths";

/** Strip the file extension from a filename for display purposes. */
function withoutExtension(basename: string): string {
  const extension = Paths.extension(basename);
  if (!extension) {
    return basename;
  }
  const stem = basename.slice(0, -(extension.length + 1));
  return stem || basename;
}

/**
 * In-canvas notebook masthead (the Hex-style title block, in the Skies
 * voice): kicker, display title, and a mono meta row. Rendered above the
 * cell column in the edit-mode vertical layout.
 *
 * Title precedence mirrors the document title: app_title, then filename
 * stem, then the unnamed placeholder.
 */
export const NotebookTitleBlock: React.FC<{ appConfig: AppConfig }> = ({
  appConfig,
}) => {
  const filename = useFilename();
  const cellCount = useCellIds().idLength;

  const basename = filename ? Paths.basename(filename) : null;
  const title =
    appConfig.app_title ||
    (basename ? withoutExtension(basename) : "Untitled notebook");

  return (
    <header className="skies-nb-masthead" data-testid="notebook-title-block">
      <p className="skies-kicker">notebook</p>
      <h1 className="skies-nb-masthead__title">{title}</h1>
      <div className="skies-nb-masthead__meta">
        {basename && <span>{basename}</span>}
        {basename && <span className="dot">·</span>}
        <span>
          {cellCount} {cellCount === 1 ? "cell" : "cells"}
        </span>
      </div>
    </header>
  );
};
