/* Copyright 2026 Marimo. All rights reserved. */

import { ChevronDown } from "lucide-react";
import * as React from "react";
import {
  type ImperativePanelHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import useEvent from "react-use-event-hook";
import useResizeObserver from "use-resize-observer";
import { z } from "zod";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";
import { ZodLocalStorage } from "@/utils/storage/typed";

/**
 * Styled AccordionItem for sidebar panels.
 * Applies border-b by default; set `lastItem` to remove it on the final item.
 */
const PanelAccordionItem = React.forwardRef<
  React.ComponentRef<typeof AccordionItem>,
  React.ComponentPropsWithoutRef<typeof AccordionItem> & {
    lastItem?: boolean;
  }
>(({ className, lastItem, ...props }, ref) => (
  <AccordionItem
    ref={ref}
    className={cn(lastItem && "border-b-0", className)}
    {...props}
  />
));
PanelAccordionItem.displayName = "PanelAccordionItem";

/**
 * Styled AccordionTrigger for sidebar panels.
 * Skies section header: the site's mono label voice — 10px JetBrains Mono
 * uppercase with 0.12em tracking, muted color, small (12px) chevron. Wraps
 * children in a flex container with gap for icon + label layout.
 */
const PanelAccordionTrigger = React.forwardRef<
  React.ComponentRef<typeof AccordionTrigger>,
  React.ComponentPropsWithoutRef<typeof AccordionTrigger>
>(({ className, children, ...props }, ref) => (
  <AccordionTrigger
    ref={ref}
    className={cn(
      "px-3 py-1.5 text-[10px] font-mono font-medium uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground hover:no-underline [&>svg]:h-3 [&>svg]:w-3",
      className,
    )}
    {...props}
  >
    <span className="flex items-center gap-2">{children}</span>
  </AccordionTrigger>
));
PanelAccordionTrigger.displayName = "PanelAccordionTrigger";

/**
 * Styled AccordionContent for sidebar panels.
 * Removes default wrapper padding.
 */
const PanelAccordionContent = React.forwardRef<
  React.ComponentRef<typeof AccordionContent>,
  React.ComponentPropsWithoutRef<typeof AccordionContent>
>(({ wrapperClassName, ...props }, ref) => (
  <AccordionContent
    ref={ref}
    wrapperClassName={cn("p-0", wrapperClassName)}
    {...props}
  />
));
PanelAccordionContent.displayName = "PanelAccordionContent";

/**
 * Styled Badge for sidebar panels.
 */
const PanelBadge = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Badge>) => (
  <Badge
    variant="secondary"
    className={cn("py-0 px-1.5 text-[10px]", className)}
    {...props}
  />
);
PanelBadge.displayName = "PanelBadge";

// Height of a section header row (px-3 py-1.5 text-[10px] uppercase = ~28px).
// A collapsed section shrinks to exactly this, leaving just its header.
const SECTION_HEADER_HEIGHT_PX = 28;
// Minimum height given to an expanded section's content while dragging.
const SECTION_MIN_CONTENT_PX = 96;

// react-resizable-panels only speaks percentages, so pixel constraints are
// converted against the measured panel height.
function pxToPercent(opts: {
  px: number;
  totalPx: number;
  fallback: number;
}): number {
  if (opts.totalPx <= 0) {
    return opts.fallback;
  }
  return Math.min(100, (opts.px / opts.totalPx) * 100);
}

const sectionLayoutStorage = new ZodLocalStorage<number[]>(
  z.array(z.number()),
  () => [],
);

function sectionLayoutKey(storageKey: string): string {
  return `marimo:panel-sections:${storageKey}:layout`;
}

/**
 * Validates a persisted panel-section layout. Returns `undefined` when the
 * stored value is missing or malformed so callers fall back to defaults.
 * `panelCount` includes the trailing spacer panel.
 */
export function sanitizeSectionLayout(
  layout: number[],
  panelCount: number,
): number[] | undefined {
  if (layout.length !== panelCount) {
    return undefined;
  }
  if (!layout.every((size) => Number.isFinite(size) && size >= 0)) {
    return undefined;
  }
  if (layout.reduce((sum, size) => sum + size, 0) <= 0) {
    return undefined;
  }
  return layout;
}

export interface ResizablePanelSection {
  /** Stable section id; also used for panel ids and aria wiring. */
  id: string;
  /** Header row contents (icon + label + optional badge). */
  header: React.ReactNode;
  /** Section body; rendered below the header and resized by the divider. */
  content: React.ReactNode;
  /** Initial size in percent when no layout has been persisted yet. */
  defaultSize?: number;
}

interface ResizablePanelSectionsProps {
  /** Unique key per panel; the drag layout is persisted under this key. */
  storageKey: string;
  sections: ResizablePanelSection[];
  /** Ids of the currently expanded sections (controlled). */
  openSections: string[];
  onOpenSectionsChange: (openSections: string[]) => void;
  className?: string;
}

/**
 * Hairline divider between two sections. The visible line is 1px (matching
 * the border-b dividers used elsewhere in the sidebar), while
 * `hitAreaMargins` widens the interactive area to ~7px. A centered grip pill
 * fades in on hover/drag/keyboard-focus so the affordance reads before the
 * cursor does. Keyboard resizing (arrow keys) comes from
 * react-resizable-panels' separator role.
 */
const PanelSectionResizeHandle: React.FC = () => (
  <PanelResizeHandle
    hitAreaMargins={{ coarse: 12, fine: 3 }}
    className={cn(
      "group relative h-px shrink-0 cursor-row-resize bg-border outline-none",
      "hover:bg-primary/30 focus-visible:bg-primary/40 data-[resize-handle-state=drag]:bg-primary/40",
      "motion-safe:transition-colors",
    )}
  >
    <span
      aria-hidden={true}
      className={cn(
        "absolute left-1/2 top-1/2 h-[3px] w-6 -translate-x-1/2 -translate-y-1/2 rounded-full",
        "bg-muted-foreground/0 group-hover:bg-primary/40 group-focus-visible:bg-primary/50 group-data-[resize-handle-state=drag]:bg-primary/60",
        "motion-safe:transition-colors",
      )}
    />
  </PanelResizeHandle>
);
PanelSectionResizeHandle.displayName = "PanelSectionResizeHandle";

/**
 * Stacked, collapsible panel sections with a drag-adjustable divider —
 * VS Code-style sidebar behavior. Section headers toggle collapse (a
 * collapsed section shrinks to just its header); the divider between
 * sections drag-resizes them; the layout persists to localStorage under
 * `marimo:panel-sections:{storageKey}:layout`.
 *
 * A trailing zero-size spacer panel absorbs leftover space so that
 * collapsing every section stacks the headers at the top (instead of
 * stretching them proportionally).
 */
const ResizablePanelSections: React.FC<ResizablePanelSectionsProps> = ({
  storageKey,
  sections,
  openSections,
  onOpenSectionsChange,
  className,
}) => {
  const { ref: containerRef, height: containerHeight = 0 } =
    useResizeObserver<HTMLDivElement>();
  const panelRefs = React.useRef(new Map<string, ImperativePanelHandle>());

  const collapsedSize = pxToPercent({
    px: SECTION_HEADER_HEIGHT_PX,
    totalPx: containerHeight,
    fallback: 6,
  });
  const minSize = Math.max(
    collapsedSize + 1,
    Math.min(
      pxToPercent({
        px: SECTION_HEADER_HEIGHT_PX + SECTION_MIN_CONTENT_PX,
        totalPx: containerHeight,
        fallback: 30,
      }),
      // Keep the constraint satisfiable for very short panels.
      100 / sections.length,
    ),
  );

  // Sections plus the trailing spacer panel.
  const defaultLayout = React.useMemo(() => {
    const panelCount = sections.length + 1;
    const stored = sanitizeSectionLayout(
      sectionLayoutStorage.get(sectionLayoutKey(storageKey)),
      panelCount,
    );
    if (stored) {
      return stored;
    }
    const equalShare = 100 / sections.length;
    return [
      ...sections.map((section) => section.defaultSize ?? equalShare),
      0, // spacer
    ];
    // sections identities are stable per panel; keyed by storageKey + count.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, sections.length]);

  // Last known collapse state per section, kept up to date by the panels'
  // onCollapse/onExpand callbacks (which fire for drags and imperative
  // calls alike). Queried instead of the imperative isCollapsed() API,
  // which asserts while the group hasn't computed its layout yet.
  const collapsedById = React.useRef(new Map<string, boolean>());

  const setSectionOpen = useEvent((sectionId: string, open: boolean) => {
    const isOpen = openSections.includes(sectionId);
    if (open === isOpen) {
      return;
    }
    onOpenSectionsChange(
      open
        ? [...openSections, sectionId]
        : openSections.filter((id) => id !== sectionId),
    );
  });

  // Keep panel collapse state in sync with the controlled `openSections`.
  // expand() restores the size the section had before it was collapsed; the
  // fallback is its persisted/default share so a freshly mounted section
  // never reopens at its minimum.
  React.useEffect(() => {
    sections.forEach((section, index) => {
      const shouldBeOpen = openSections.includes(section.id);
      const knownCollapsed = collapsedById.current.get(section.id);
      if (knownCollapsed === undefined) {
        // First sync: defaultSize already encodes open vs. collapsed, so
        // just seed the known state.
        collapsedById.current.set(section.id, !shouldBeOpen);
        return;
      }
      if (knownCollapsed === !shouldBeOpen) {
        return;
      }
      const handle = panelRefs.current.get(section.id);
      if (!handle) {
        return;
      }
      if (shouldBeOpen) {
        handle.expand(Math.max(defaultLayout[index], minSize));
      } else {
        handle.collapse();
      }
    });
  }, [sections, openSections, defaultLayout, minSize]);

  const persistLayout = useEvent((layout: number[]) => {
    sectionLayoutStorage.set(sectionLayoutKey(storageKey), layout);
  });

  return (
    <div
      ref={containerRef}
      className={cn("h-full overflow-hidden", className)}
    >
      <PanelGroup
        direction="vertical"
        onLayout={persistLayout}
        className="h-full"
      >
        {sections.map((section, index) => {
          const isOpen = openSections.includes(section.id);
          const contentId = `${storageKey}-section-${section.id}`;
          return (
            <React.Fragment key={section.id}>
              {index > 0 && <PanelSectionResizeHandle />}
              <Panel
                id={`${storageKey}-${section.id}`}
                order={index}
                collapsible={true}
                collapsedSize={collapsedSize}
                minSize={minSize}
                defaultSize={
                  isOpen ? defaultLayout[index] : collapsedSize
                }
                onCollapse={() => {
                  collapsedById.current.set(section.id, true);
                  setSectionOpen(section.id, false);
                }}
                onExpand={() => {
                  collapsedById.current.set(section.id, false);
                  setSectionOpen(section.id, true);
                }}
                ref={(handle: ImperativePanelHandle | null) => {
                  if (handle) {
                    panelRefs.current.set(section.id, handle);
                  } else {
                    panelRefs.current.delete(section.id);
                  }
                }}
                className="flex flex-col overflow-hidden"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={contentId}
                  onClick={() => setSectionOpen(section.id, !isOpen)}
                  className={cn(
                    "flex w-full shrink-0 items-center justify-between px-3 py-1.5 text-start",
                    "text-[10px] font-mono font-medium uppercase tracking-[0.12em]",
                    "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {section.header}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 motion-safe:transition-transform motion-safe:duration-200",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>
                <div id={contentId} className="flex-1 min-h-0">
                  {section.content}
                </div>
              </Panel>
            </React.Fragment>
          );
        })}
        {/* Absorbs leftover space when sections collapse so headers stack
            at the top instead of stretching. */}
        <Panel
          id={`${storageKey}-spacer`}
          order={sections.length}
          defaultSize={defaultLayout[sections.length]}
          minSize={0}
          aria-hidden={true}
          className="pointer-events-none"
        />
      </PanelGroup>
    </div>
  );
};
ResizablePanelSections.displayName = "ResizablePanelSections";

export {
  PanelAccordionItem,
  PanelAccordionTrigger,
  PanelAccordionContent,
  PanelBadge,
  ResizablePanelSections,
};
