/* Copyright 2026 Marimo. All rights reserved. */

import type React from "react";
import type {
  NotebookPreviewCell,
  NotebookPreviewResponse,
} from "@/core/network/types";
import { cn } from "@/utils/cn";
import { tintForPath } from "./preview-seed";
import type { PreviewStatus } from "./use-notebook-preview";

/**
 * A faithful, execution-free "mini mockup" of the TOP of a notebook — its
 * title and first cells rendered as a shrunk document page (serif title,
 * real tiny markdown prose, copper/sky gutter-barred code silhouettes, and
 * chart/table/widget output glyphs) on a stable per-notebook tinted paper.
 *
 * A pure renderer: the parent card/row owns the lazy fetch (so the same
 * payload also drives the type chips) and passes `preview`/`status` down.
 * Authored at literal small px sizes (no CSS `transform: scale()`, which
 * blurs). Fills its positioned parent via `absolute inset-0`. Purely
 * decorative — the card's `<a aria-label>` names it.
 */

interface CustomProps extends React.CSSProperties {
  "--nb-paper": string;
  "--nb-edge": string;
}

// ---- output glyphs --------------------------------------------------------

const ChartGlyph: React.FC = () => (
  <div className="flex h-[15px] items-end gap-[2px]">
    {[8, 13, 6, 15, 10].map((h, i) => (
      <div
        key={i}
        className="w-[3px] rounded-[1px] bg-[var(--sky-blue)] opacity-70"
        style={{ height: h }}
      />
    ))}
  </div>
);

const TableGlyph: React.FC = () => (
  <div className="grid h-[16px] w-[24px] grid-cols-3 grid-rows-3">
    {Array.from({ length: 9 }).map((_, i) => (
      <div
        key={i}
        className={cn(
          "border-[0.5px] border-border",
          i < 3 && "bg-[var(--nb-edge)] opacity-60",
        )}
      />
    ))}
  </div>
);

const WidgetGlyph: React.FC = () => (
  <div className="flex flex-col items-center gap-[3px]">
    <div className="relative h-[4px] w-[22px] rounded-full bg-[var(--nb-edge)]">
      <span className="-top-[1px] absolute left-[6px] h-[6px] w-[6px] rounded-full border-[0.5px] border-border bg-[var(--gold)]" />
    </div>
    <div className="h-[5px] w-[14px] rounded-[1px] border-[0.5px] border-border" />
  </div>
);

const VisualBlock: React.FC<{ visual: NotebookPreviewCell["visual"] }> = ({
  visual,
}) => (
  <div
    className="relative mt-[3px] flex h-[26px] items-center justify-center overflow-hidden rounded-[2px] border border-border"
    style={{ background: "color-mix(in srgb, var(--nb-edge) 12%, var(--card))" }}
  >
    {visual === "chart" && <ChartGlyph />}
    {visual === "table" && <TableGlyph />}
    {visual === "widget" && <WidgetGlyph />}
    <span className="absolute right-[3px] bottom-[1px] font-mono text-[6.5px] uppercase tracking-[0.04em] text-[var(--foreground-dim)]">
      {visual}
    </span>
  </div>
);

// ---- code / markdown blocks ----------------------------------------------

const StubBars: React.FC = () => (
  <div className="flex flex-col gap-[3px]">
    {[70, 90, 55].map((w) => (
      <div
        key={w}
        className="h-[5px] rounded-[1px] bg-border"
        style={{ width: `${w}%` }}
      />
    ))}
  </div>
);

const CodeSilhouette: React.FC<{ cell: NotebookPreviewCell }> = ({ cell }) => {
  const lines = cell.lines.slice(0, 4);
  return (
    <div
      className={cn(
        "rounded-[2px] border-l-2 py-[3px] pr-1 pl-1.5",
        cell.cellType === "sql"
          ? "border-[var(--copper)]"
          : "border-[var(--sky-blue)]",
      )}
      style={{
        background: "color-mix(in srgb, var(--card) 88%, var(--foreground) 4%)",
      }}
    >
      {lines.length === 0 ? (
        <StubBars />
      ) : (
        lines.map((line, i) => (
          <div
            key={i}
            className="truncate whitespace-pre font-mono text-[7px] leading-[1.6]"
            style={{ color: "color-mix(in srgb, var(--foreground) 55%, transparent)" }}
          >
            {line || " "}
          </div>
        ))
      )}
    </div>
  );
};

/** Strip inline markdown tokens so the shrunk prose reads as clean text. */
function cleanMarkdown(text: string): string {
  return text.replace(/[*`_>]/g, "").replace(/^[-+]\s+/, "").trim();
}

const MarkdownBlock: React.FC<{ text: string; omitHeading?: string | null }> = ({
  text,
  omitHeading,
}) => {
  const rawLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (rawLines.length === 0) {
    return null;
  }
  const first = rawLines[0];
  const rawHeading = /^(#{1,3})\s*(.*)$/.exec(first);
  // Suppress the heading that already appears as the preview's title banner,
  // so the title isn't shown twice. Compare cleaned-to-cleaned so inline
  // markdown tokens in the title (e.g. `code`) don't defeat the match.
  const omit = omitHeading ? cleanMarkdown(omitHeading) : null;
  const heading =
    rawHeading && cleanMarkdown(rawHeading[2]) === omit ? null : rawHeading;
  const bodyLines = rawHeading ? rawLines.slice(1) : rawLines;
  const body = cleanMarkdown(bodyLines.join(" ")).slice(0, 96);
  // A cell that was only the (suppressed) title heading renders nothing.
  if (!heading && !body) {
    return null;
  }

  return (
    <div className="flex flex-col gap-[2px]">
      {heading && (
        <span
          className={cn(
            "line-clamp-1 font-[var(--heading-font)] tracking-[-0.012em] text-foreground",
            heading[1] === "#" && "font-bold text-[10px]",
            heading[1] === "##" && "font-semibold text-[9px]",
            heading[1] === "###" && "font-medium text-[8.5px]",
          )}
        >
          {cleanMarkdown(heading[2])}
        </span>
      )}
      {body && (
        <span className="line-clamp-2 text-[7.5px] leading-[1.5] text-[var(--muted-foreground)]">
          {body}
        </span>
      )}
    </div>
  );
};

const CellBlock: React.FC<{
  cell: NotebookPreviewCell;
  title?: string | null;
}> = ({ cell, title }) => {
  if (cell.cellType === "markdown") {
    return <MarkdownBlock text={cell.markdown ?? ""} omitHeading={title} />;
  }
  // Code/sql cell: a source silhouette, plus an output glyph when the cell
  // renders one — mirroring how a real marimo cell shows code then output.
  return (
    <div className="flex flex-col">
      <CodeSilhouette cell={cell} />
      {cell.visual !== "none" && <VisualBlock visual={cell.visual} />}
    </div>
  );
};

// ---- states ---------------------------------------------------------------

const Skeleton: React.FC = () => (
  <>
    <div className="h-[11px] w-3/4 rounded-[2px] bg-border motion-safe:animate-pulse" />
    {[90, 70, 80].map((w) => (
      <div
        key={w}
        className="h-[7px] rounded-[2px] bg-border motion-safe:animate-pulse"
        style={{ width: `${w}%` }}
      />
    ))}
  </>
);

const NoPreview: React.FC<{ name: string }> = ({ name }) => {
  const initial = (name.trim()[0] ?? "•").toUpperCase();
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <span className="absolute select-none font-[var(--heading-font)] font-bold text-[64px] text-foreground leading-none opacity-[0.06]">
        {initial}
      </span>
      <span className="relative font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--foreground-dim)]">
        no preview
      </span>
    </div>
  );
};

// ---- component ------------------------------------------------------------

const isEmptyPreview = (preview: NotebookPreviewResponse | null): boolean =>
  !preview || preview.cells.length === 0;

export const NotebookMiniPreview: React.FC<{
  path: string;
  name: string;
  /** The 20×20 list micro-thumb: tinted paper + bars only. */
  compact?: boolean;
  /** The lazily-fetched preview payload (owned by the parent). */
  preview?: NotebookPreviewResponse | null;
  status?: PreviewStatus;
}> = ({ path, name, compact = false, preview = null, status = "idle" }) => {
  const { paper, edge } = tintForPath(path);
  const style: CustomProps = { "--nb-paper": paper, "--nb-edge": edge };

  if (compact) {
    return (
      <div
        aria-hidden={true}
        style={style}
        className="skies-nb-preview pointer-events-none absolute inset-0 flex flex-col justify-center gap-[2px] px-1.5"
      >
        {[90, 62, 78].map((w) => (
          <div
            key={w}
            className="h-[2px] rounded-full bg-[var(--nb-edge)]"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    );
  }

  const loading = status === "idle" || status === "loading";
  const noPreview =
    status === "error" || (status === "ready" && isEmptyPreview(preview));

  return (
    <div
      aria-hidden={true}
      style={style}
      className="skies-nb-preview pointer-events-none absolute inset-0 overflow-hidden"
    >
      {noPreview ? (
        <NoPreview name={name} />
      ) : (
        <div className="absolute inset-x-2.5 top-2 flex flex-col gap-[5px] overflow-hidden">
          {loading || !preview ? (
            <Skeleton />
          ) : (
            <>
              {preview.title && (
                <div className="flex flex-col">
                  <span className="line-clamp-2 font-[var(--heading-font)] font-bold text-[11px] leading-tight tracking-[-0.012em] text-foreground">
                    {cleanMarkdown(preview.title)}
                  </span>
                  <span className="my-[3px] h-px bg-border" />
                </div>
              )}
              {preview.cells.map((cell, i) => (
                <CellBlock key={i} cell={cell} title={preview.title} />
              ))}
            </>
          )}
        </div>
      )}
      {/* Bottom scrim: fades the last partial cell into the same tinted paper. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
        style={{ background: "linear-gradient(to top, var(--nb-paper), transparent)" }}
      />
    </div>
  );
};
