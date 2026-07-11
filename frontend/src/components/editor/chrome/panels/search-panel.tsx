/* Copyright 2026 Marimo. All rights reserved. */

import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { SearchIcon } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCellActions, useNotebook } from "@/core/cells/cells";
import { useCellFocusActions } from "@/core/cells/focus";
import type { CellId } from "@/core/cells/ids";
import { displayCellName } from "@/core/cells/names";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/utils/cn";
import { raf2 } from "../../navigation/focus-utils";
import { PanelEmptyState } from "./empty-state";
import { PANEL_SEARCH_INPUT_ROOT, PANEL_SEARCH_ROW } from "./panel-styles";

/** Cap total matches so pathological queries (e.g. "a") stay responsive. */
const MAX_MATCHES = 500;

interface LineMatch {
  /** 0-based line index in the cell's code. */
  lineIndex: number;
  /** Line text with leading whitespace stripped, for display. */
  text: string;
  /** Match ranges within `text` (start, end). */
  ranges: Array<[number, number]>;
  /** Absolute offset of the first match in the cell's document. */
  from: number;
  /** Absolute end offset of the first match in the cell's document. */
  to: number;
}

interface CellMatches {
  cellId: CellId;
  /** Display name for the group header ("cell-N" for unnamed cells). */
  name: string;
  lines: LineMatch[];
  matchCount: number;
}

interface SearchResults {
  cells: CellMatches[];
  matchCount: number;
  truncated: boolean;
}

function findMatchesInCode(
  code: string,
  query: string,
  caseSensitive: boolean,
  budget: number,
): { lines: LineMatch[]; matchCount: number } {
  const haystackCode = caseSensitive ? code : code.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const lines: LineMatch[] = [];
  let matchCount = 0;

  let lineStart = 0;
  const rawLines = code.split("\n");
  for (const [lineIndex, rawLine] of rawLines.entries()) {
    if (matchCount >= budget) {
      break;
    }
    const haystackLine = haystackCode.slice(
      lineStart,
      lineStart + rawLine.length,
    );
    const ranges: Array<[number, number]> = [];
    let index = haystackLine.indexOf(needle);
    while (index !== -1 && matchCount < budget) {
      ranges.push([index, index + needle.length]);
      matchCount++;
      index = haystackLine.indexOf(needle, index + needle.length);
    }
    if (ranges.length > 0) {
      // Strip leading whitespace for display; shift ranges to match.
      const trimmed = rawLine.trimStart();
      const shift = rawLine.length - trimmed.length;
      lines.push({
        lineIndex,
        text: trimmed,
        ranges: ranges.map(([from, to]) => [
          Math.max(0, from - shift),
          Math.max(0, to - shift),
        ]),
        from: lineStart + ranges[0][0],
        to: lineStart + ranges[0][1],
      });
    }
    lineStart += rawLine.length + 1; // +1 for the newline
  }

  return { lines, matchCount };
}

/** Render a line with each match substring wrapped in a brand-tinted <mark>. */
function highlightRanges(
  text: string,
  ranges: Array<[number, number]>,
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const [from, to] of ranges) {
    if (from > cursor) {
      parts.push(text.slice(cursor, from));
    }
    parts.push(
      <mark
        key={`${from}-${to}`}
        className="bg-primary/20 text-inherit rounded-[2px]"
      >
        {text.slice(from, to)}
      </mark>,
    );
    cursor = to;
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return parts;
}

const SearchPanel: React.FC = () => {
  const notebook = useNotebook();
  const cellActions = useCellActions();
  const focusActions = useCellFocusActions();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [activeMatchKey, setActiveMatchKey] = useState<string | null>(null);
  const debouncedQuery = useDebounce(query, 150);

  // Focus the input when the panel becomes visible. Effects re-run each time
  // the surrounding <Activity> toggles to visible, and raf2 defers the focus
  // until the sidebar panel has finished expanding.
  useEffect(() => {
    raf2(() => inputRef.current?.focus());
  }, []);

  const results = useMemo<SearchResults>(() => {
    if (!debouncedQuery) {
      return { cells: [], matchCount: 0, truncated: false };
    }
    const { cellIds, cellData, cellHandles } = notebook;
    const cells: CellMatches[] = [];
    let matchCount = 0;
    for (const [index, cellId] of cellIds.inOrderIds.entries()) {
      if (matchCount >= MAX_MATCHES) {
        break;
      }
      // Prefer the live editor document (unsaved edits) over persisted code.
      const editorView = cellHandles[cellId]?.current?.editorViewOrNull;
      const code = editorView
        ? editorView.state.doc.toString()
        : (cellData[cellId]?.code ?? "");
      const cellMatches = findMatchesInCode(
        code,
        debouncedQuery,
        caseSensitive,
        MAX_MATCHES - matchCount,
      );
      if (cellMatches.matchCount > 0) {
        cells.push({
          cellId,
          name: displayCellName(cellData[cellId]?.name ?? "", index),
          lines: cellMatches.lines,
          matchCount: cellMatches.matchCount,
        });
        matchCount += cellMatches.matchCount;
      }
    }
    return { cells, matchCount, truncated: matchCount >= MAX_MATCHES };
  }, [debouncedQuery, caseSensitive, notebook]);

  const handleJumpToMatch = (cellId: CellId, line: LineMatch) => {
    setActiveMatchKey(`${cellId}:${line.lineIndex}`);
    // Reuse the notebook's own scroll/focus path (same as the minimap):
    // focusCell dispatches focusAndScrollCellIntoView under the hood.
    cellActions.focusCell({ cellId, where: "exact" });
    focusActions.focusCell({ cellId });
    // Select the match inside the editor, mirroring find-replace navigation.
    const editorView = notebook.cellHandles[cellId]?.current?.editorViewOrNull;
    if (editorView) {
      const docLength = editorView.state.doc.length;
      const from = Math.min(line.from, docLength);
      const to = Math.min(line.to, docLength);
      const selection = EditorSelection.single(from, to);
      editorView.dispatch({
        selection,
        effects: [EditorView.scrollIntoView(selection.main, { y: "center" })],
        userEvent: "select.search",
      });
    }
  };

  const hasQuery = debouncedQuery.length > 0;
  const cellCount = results.cells.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Data-browser search row: a flat bordered pill + a case-sensitivity toggle */}
      <div className={PANEL_SEARCH_ROW}>
        <div
          className={cn(PANEL_SEARCH_INPUT_ROOT, "flex items-center gap-1.5")}
        >
          <SearchIcon
            strokeWidth={1.5}
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          />
          <input
            ref={inputRef}
            data-testid="search-panel-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cells"
            spellCheck={false}
            className="flex-1 min-w-0 h-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        <button
          type="button"
          data-testid="search-panel-case-toggle"
          aria-label="Match case"
          aria-pressed={caseSensitive}
          title="Match case"
          onClick={() => setCaseSensitive((v) => !v)}
          className={cn(
            "h-7 w-7 shrink-0 flex items-center justify-center rounded-[3px] text-[11px] font-medium leading-none",
            caseSensitive
              ? "bg-primary/[0.07] text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-[var(--hover-wash)]",
          )}
        >
          Aa
        </button>
      </div>

      {!hasQuery && (
        <PanelEmptyState
          title="Search your notebook"
          description="Matches across all cells appear here. Click a match to jump to its cell."
          icon={<SearchIcon />}
        />
      )}

      {hasQuery && results.matchCount === 0 && (
        <PanelEmptyState
          title="No results"
          description={`No matches for "${debouncedQuery}".`}
          icon={<SearchIcon />}
        />
      )}

      {hasQuery && results.matchCount > 0 && (
        <>
          <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-b border-border shrink-0">
            {results.truncated ? `${MAX_MATCHES}+` : results.matchCount} result
            {results.matchCount === 1 ? "" : "s"} in {cellCount} cell
            {cellCount === 1 ? "" : "s"}
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {results.cells.map((cell) => (
              <div key={cell.cellId} className="pb-1">
                <div className="px-3 h-7 flex items-center font-code text-[11px] text-muted-foreground truncate">
                  {cell.name}
                </div>
                {cell.lines.map((line) => {
                  const key = `${cell.cellId}:${line.lineIndex}`;
                  const isActive = activeMatchKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleJumpToMatch(cell.cellId, line)}
                      // Avoid blurring the currently focused cell on mousedown,
                      // which causes a focus flicker (same trick as the minimap).
                      onMouseDown={(e) => e.preventDefault()}
                      className={cn(
                        "w-full h-7 flex items-center px-3 pl-5 text-[13px] text-left rounded-[3px] cursor-pointer",
                        isActive
                          ? "bg-primary/[0.07] text-primary"
                          : "text-foreground hover:bg-[var(--hover-wash)]",
                      )}
                    >
                      <span className="truncate font-code text-xs">
                        {highlightRanges(line.text, line.ranges)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default SearchPanel;
