/* Copyright 2026 Marimo. All rights reserved. */
import { python } from "@codemirror/lang-python";
import { unifiedMergeView } from "@codemirror/merge";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { memo, useMemo } from "react";
import { darkTheme } from "@/core/codemirror/theme/dark";
import { lightTheme } from "@/core/codemirror/theme/light";
import { useTheme } from "@/theme/useTheme";

export const ReadonlyDiff = memo(
  (props: { original: string; modified: string }) => {
    const { theme } = useTheme();

    const extensions = useMemo(() => {
      return [
        // Read like an actual cell: Python highlighting + the Skies editor
        // theme (same as core/codemirror/cm.ts), not CodeMirror's generic
        // light/dark. The diff gutter layers on top.
        python(),
        EditorView.lineWrapping,
        unifiedMergeView({
          original: props.original,
          mergeControls: false,
          collapseUnchanged: {
            margin: 3,
            minSize: 4,
          },
        }),
        theme === "dark" ? darkTheme : lightTheme,
      ];
    }, [props.original, theme]);

    return (
      <CodeMirror
        // `.cm` gives the notebook's code font + default editor font size, so
        // the preview matches cells rather than shrinking to a tiny mono.
        className="cm"
        extensions={extensions}
        readOnly={true}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          dropCursor: false,
          highlightActiveLineGutter: false,
          allowMultipleSelections: false,
          indentOnInput: false,
          bracketMatching: false,
          closeBrackets: false,
          autocompletion: false,
        }}
        // The Skies theme is supplied via extensions above; keep CodeMirror's
        // own theme out of the way.
        theme="none"
        value={props.modified}
      />
    );
  },
);
ReadonlyDiff.displayName = "ReadonlyDiff";
