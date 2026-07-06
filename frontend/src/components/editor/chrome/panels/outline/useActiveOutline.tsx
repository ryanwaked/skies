/* Copyright 2026 Marimo. All rights reserved. */

import { useEffect, useRef, useState } from "react";
import type { OutlineItem } from "@/core/cells/outline";
import { headingToIdentifier } from "@/core/dom/outline";
import { getInitialAppMode } from "@/core/mode";
import { Logger } from "@/utils/Logger";

function getRootScrollableElement(): HTMLElement {
  // The notebook scrolls inside #App in edit mode; run mode scrolls the
  // document. Fall back to the document element so the scroll-spy always
  // has a container to listen on.
  return getInitialAppMode() === "edit"
    ? (document.getElementById("App") ?? document.documentElement)
    : document.documentElement;
}

// Reference line below the top bar: the heading last crossing above this
// line is the section the reader is currently in.
const ACTIVE_LINE_OFFSET = 100;

/**
 * React hook to find the active header in the outline.
 *
 * Uses a position-based scroll-spy (not a pure IntersectionObserver): on
 * every scroll it picks the last heading whose top has crossed above the
 * reference line, so the highlight tracks the section you're reading and
 * never blanks out mid-section (the old "topmost intersecting" logic left
 * a dead zone whenever a long section had no heading in view).
 */
export function useActiveOutline(
  headerElements: (readonly [HTMLElement, string])[],
) {
  const [activeHeaderId, setActiveHeaderId] = useState<string | undefined>(
    undefined,
  );
  const [activeOccurrences, setActiveOccurrences] = useState<
    number | undefined
  >(undefined);

  const occurrences = useRef<Map<HTMLElement, number>>(
    new Map<HTMLElement, number>(),
  );

  useEffect(() => {
    if (headerElements.length === 0) {
      setActiveHeaderId(undefined);
      setActiveOccurrences(undefined);
      return;
    }

    // Precompute the occurrence index for duplicate-text headings.
    occurrences.current = new Map<HTMLElement, number>();
    headerElements.forEach(([element]) => {
      const identifier = headingToIdentifier(element);
      const idx = headerElements
        .map(([el]) => el)
        .filter((el) =>
          "id" in identifier
            ? el.id === identifier.id
            : el.textContent === element.textContent,
        )
        .indexOf(element);
      occurrences.current.set(element, idx);
    });

    const scroller = getRootScrollableElement();
    // #App is offset in the viewport; the document element sits at 0.
    const containerTop = () =>
      scroller && scroller !== document.documentElement
        ? scroller.getBoundingClientRect().top
        : 0;

    const computeActive = () => {
      const line = containerTop() + ACTIVE_LINE_OFFSET;
      let active: HTMLElement | null = null;
      // Headings are in document order; the last one above the line wins.
      for (const [element] of headerElements) {
        if (element.getBoundingClientRect().top <= line) {
          active = element;
        } else {
          break;
        }
      }
      // Before the first heading, highlight the first one so the outline is
      // never empty while content is on screen.
      active ??= headerElements[0][0];

      const identifier = headingToIdentifier(active);
      const id = "id" in identifier ? identifier.id : identifier.path;
      setActiveHeaderId(id);
      setActiveOccurrences(occurrences.current.get(active));
    };

    // rAF-throttle: coalesce scroll bursts into one measurement per frame.
    let frame = 0;
    const onScroll = () => {
      if (frame) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = 0;
        computeActive();
      });
    };

    computeActive();
    const scrollTarget: EventTarget =
      scroller === document.documentElement ? window : scroller;
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      scrollTarget.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [headerElements]);

  return { activeHeaderId, activeOccurrences };
}

/**
 * Finds all the outline elements in the document
 */
export function findOutlineElements(items: OutlineItem[]) {
  if (items.length === 0) {
    return [];
  }

  // Map of selector to its occurrences
  const seen = new Map<string, number>();

  return items
    .map((item) => {
      const identifier = "id" in item.by ? item.by.id : item.by.path;
      // Keep track of how many times we've seen this selector
      const occurrences = seen.get(identifier) ?? 0;
      seen.set(identifier, occurrences + 1);

      const el = findOutlineItem(item, occurrences);
      if (!el) {
        return null;
      }

      return [el, identifier] as const;
    })
    .filter(Boolean);
}

/**
 * Scrolls to the outline item in the document
 */
export function scrollToOutlineItem(item: OutlineItem, index: number) {
  const element = findOutlineItem(item, index);
  if (!element) {
    Logger.warn("Could not find element for outline item", item);
    return;
  }

  element.scrollIntoView({ behavior: "smooth", block: "start" });

  // Add underline to the element for a few seconds
  element.classList.add("outline-item-highlight");
  setTimeout(() => {
    element.classList.remove("outline-item-highlight");
  }, 3000);
}

/**
 * Finds the element in the document that matches the outline item
 */
export function findOutlineItem(
  item: OutlineItem,
  index: number,
): HTMLElement | null {
  if ("id" in item.by) {
    // Selectors may be duplicated, so we need to use querySelectorAll
    // IDs that start with a number are invalid, so we need to escape them
    const elems = document.querySelectorAll<HTMLElement>(
      `[id="${CSS.escape(item.by.id)}"]`,
    );
    return elems[index];
  }
  const el = document.evaluate(
    item.by.path,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null,
  ).singleNodeValue as HTMLElement;
  return el;
}
