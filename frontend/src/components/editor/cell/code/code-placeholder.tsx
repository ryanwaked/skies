/* Copyright 2026 Marimo. All rights reserved. */
import "./code-placeholder.css";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";

interface CodePlaceholderProps {
  code: string;
  className?: string;
}

// Bound the rendered skeleton bars so a very long cell does not create
// excessive nodes; the remaining lines still reserve exact height via a
// single invisible text block below.
const MAX_BAR_LINES = 50;
const MIN_LINE_WIDTH_CH = 4;
const MAX_LINE_WIDTH_CH = 60;

function getLineWidthCh(length: number): number {
  return Math.min(MAX_LINE_WIDTH_CH, Math.max(MIN_LINE_WIDTH_CH, length));
}

/**
 * Stand-in shown while a cell's CodeMirror editor has not been built yet.
 *
 * Height must match the eventual editor EXACTLY or the notebook shifts
 * ("jumps") as editors mount during scrolling. Since the editor wraps long
 * lines (EditorView.lineWrapping), per-line height cannot be a constant:
 * each placeholder line renders the real line text invisibly — with the
 * editor's font metrics and available width — so wrapped lines reserve
 * their true height, and a skeleton bar is overlaid for the visual.
 */
export const CodePlaceholder = ({ code, className }: CodePlaceholderProps) => {
  const lines = code.split("\n");
  const barLines = lines.slice(0, MAX_BAR_LINES);
  const rest = lines.slice(MAX_BAR_LINES).join("\n");
  return (
    <div
      className={cn("cm", "mo-code-placeholder", className)}
      data-testid="cell-editor-placeholder"
      aria-hidden={true}
    >
      {barLines.map((line, index) => {
        const length = line.trimEnd().length;
        return (
          <div key={index} className="mo-code-placeholder-line">
            <span className="mo-code-placeholder-text">{line || " "}</span>
            {length > 0 && (
              <Skeleton
                className="mo-code-placeholder-bar"
                style={{ width: `${getLineWidthCh(length)}ch` }}
              />
            )}
          </div>
        );
      })}
      {rest.length > 0 && (
        <pre className="mo-code-placeholder-text mo-code-placeholder-rest">
          {rest}
        </pre>
      )}
    </div>
  );
};
