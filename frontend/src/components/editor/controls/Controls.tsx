/* Copyright 2026 Marimo. All rights reserved. */

import type { JSX } from "react";
import { KeyboardShortcuts } from "@/components/editor/controls/keyboard-shortcuts";
import { FindReplace } from "@/components/find-replace/find-replace";

interface ControlsProps {
  presenting: boolean;
}

/**
 * Floating-overlay hosts for the notebook editor. All visible chrome
 * controls live in the top bar (Run all, Save, Share, Publish) and the
 * footer (command palette, undo) — nothing floats over cell content in
 * the Skies language. This component only mounts the transient overlays:
 * Find/Replace and the keyboard-shortcuts dialog.
 */
export const Controls = ({ presenting }: ControlsProps): JSX.Element => {
  return (
    <>
      {!presenting && <FindReplace />}
      <KeyboardShortcuts />
    </>
  );
};
