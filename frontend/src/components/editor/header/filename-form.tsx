/* Copyright 2026 Marimo. All rights reserved. */

import type { JSX } from "react";
import { FilenameInput } from "@/components/editor/header/filename-input";
import { useUpdateFilename } from "@/core/saving/filename";
import { useSaveNotebook } from "@/core/saving/save-component";
import { cn } from "@/utils/cn";
import { Paths } from "@/utils/paths";

/** Strip the file extension from a filename for display purposes. */
function withoutExtension(basename: string): string {
  const extension = Paths.extension(basename);
  if (!extension) {
    return basename;
  }
  const stem = basename.slice(0, -(extension.length + 1));
  // Dotfiles like ".py" have no stem; keep the full name in that case
  return stem || basename;
}

export const FilenameForm = ({
  filename,
}: {
  filename: string | null;
}): JSX.Element => {
  const updateFilename = useUpdateFilename();
  const { saveNotebook } = useSaveNotebook();

  const handleNameChange = (newFilename: string) => {
    const wasUnnamed = filename === null;
    updateFilename(newFilename).then((name) => {
      // When creating a new file (was unnamed), also save the content
      if (name !== null && wasUnnamed) {
        saveNotebook(name, true);
      }
    });
  };

  return (
    <FilenameInput
      placeholderText={
        filename ? Paths.basename(filename) : "untitled marimo notebook"
      }
      initialValue={filename}
      displayValue={
        filename ? withoutExtension(Paths.basename(filename)) : null
      }
      onNameChange={handleNameChange}
      flexibleWidth={true}
      resetOnBlur={true}
      data-testid="filename-input"
      className={cn(
        "h-7 my-0 px-1.5 py-0 font-sans text-sm font-medium text-foreground truncate",
        filename === null ? "missing-filename" : "filename",
      )}
    />
  );
};
