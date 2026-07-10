/* Copyright 2026 Marimo. All rights reserved. */
import { atomWithStorage } from "jotai/utils";
import { jotaiJsonStorage } from "@/utils/storage/jotai";
// Default: false — Tab accepts the suggestion (see the Tab keybinding in
// cm.ts) and Enter inserts a new line. Accepting on Enter is unintuitive: it
// hijacks Enter whenever the completion popup is open, so a stray newline
// silently accepts a suggestion instead. Users who prefer the VS Code-style
// Enter-to-accept can re-enable it via Settings ("Accept suggestion on Enter").
export const acceptCompletionOnEnterAtom = atomWithStorage<boolean>(
  "marimo:accept-completion-on-enter",
  false,
  jotaiJsonStorage,
  { getOnInit: true },
);
