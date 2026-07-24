/* Copyright 2026 Marimo. All rights reserved. */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ResizablePanelSections,
  sanitizeSectionLayout,
} from "../components";

describe("sanitizeSectionLayout", () => {
  it("returns the layout when valid", () => {
    expect(sanitizeSectionLayout([40, 60, 0], 3)).toEqual([40, 60, 0]);
  });

  it("rejects layouts with the wrong panel count", () => {
    expect(sanitizeSectionLayout([50, 50], 3)).toBeUndefined();
    expect(sanitizeSectionLayout([30, 30, 30, 10], 3)).toBeUndefined();
  });

  it("rejects negative or non-finite sizes", () => {
    expect(sanitizeSectionLayout([50, -10, 60], 3)).toBeUndefined();
    expect(sanitizeSectionLayout([Number.NaN, 50, 50], 3)).toBeUndefined();
    expect(
      sanitizeSectionLayout([Number.POSITIVE_INFINITY, 0, 0], 3),
    ).toBeUndefined();
  });

  it("rejects a zero-sum layout", () => {
    expect(sanitizeSectionLayout([0, 0, 0], 3)).toBeUndefined();
  });

  it("rejects an empty layout", () => {
    expect(sanitizeSectionLayout([], 3)).toBeUndefined();
  });
});

describe("ResizablePanelSections", () => {
  const sections = [
    {
      id: "remote-storage",
      header: "Remote storage",
      content: <div>storage content</div>,
    },
    { id: "files", header: "Files", content: <div>files content</div> },
  ];

  it("renders section headers with aria-expanded state", () => {
    render(
      <ResizablePanelSections
        storageKey="test"
        sections={sections}
        openSections={["files"]}
        onOpenSectionsChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /remote storage/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /files/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("storage content")).toBeInTheDocument();
    expect(screen.getByText("files content")).toBeInTheDocument();
  });

  it("renders a keyboard-focusable separator between sections", () => {
    render(
      <ResizablePanelSections
        storageKey="test"
        sections={sections}
        openSections={["remote-storage", "files"]}
        onOpenSectionsChange={vi.fn()}
      />,
    );

    const separator = screen.getByRole("separator");
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveAttribute("tabindex", "0");
  });

  it("clicking a collapsed section header expands it", () => {
    const onOpenSectionsChange = vi.fn();
    render(
      <ResizablePanelSections
        storageKey="test"
        sections={sections}
        openSections={["files"]}
        onOpenSectionsChange={onOpenSectionsChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /remote storage/i }));
    expect(onOpenSectionsChange).toHaveBeenCalledWith([
      "files",
      "remote-storage",
    ]);
  });

  it("clicking an expanded section header collapses it", () => {
    const onOpenSectionsChange = vi.fn();
    render(
      <ResizablePanelSections
        storageKey="test"
        sections={sections}
        openSections={["remote-storage", "files"]}
        onOpenSectionsChange={onOpenSectionsChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /files/i }));
    expect(onOpenSectionsChange).toHaveBeenCalledWith(["remote-storage"]);
  });
});
