/* Copyright 2026 Marimo. All rights reserved. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openNotebookInCurrentTab, PAGE_EXIT_CLASS } from "../links";

describe("openNotebookInCurrentTab", () => {
  const originalLocation = window.location;
  const assignMock = vi.fn();

  function mockLocation(search: string) {
    Object.defineProperty(window, "location", {
      value: {
        assign: assignMock,
        search,
      },
      writable: true,
    });
  }

  beforeEach(() => {
    assignMock.mockClear();
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  function assignedUrl(): URL {
    expect(assignMock).toHaveBeenCalledTimes(1);
    return new URL(assignMock.mock.calls[0][0]);
  }

  it("navigates in the same tab with the file param", () => {
    mockLocation("?file=old.py");
    openNotebookInCurrentTab("notebooks/new.py");
    const url = assignedUrl();
    expect(url.searchParams.get("file")).toBe("notebooks/new.py");
    expect(url.searchParams.has("session_id")).toBe(false);
  });

  it("URL-encodes special characters in the path", () => {
    mockLocation("");
    openNotebookInCurrentTab("my dir/笔记本 (final).py");
    const url = assignedUrl();
    expect(url.searchParams.get("file")).toBe("my dir/笔记本 (final).py");
    // Raw URL string must not contain unencoded spaces or unicode
    expect(assignMock.mock.calls[0][0]).not.toContain(" ");
    expect(assignMock.mock.calls[0][0]).not.toContain("笔记本");
  });

  it("includes session_id when provided", () => {
    mockLocation("?file=old.py");
    openNotebookInCurrentTab("new.py", "session-123");
    const url = assignedUrl();
    expect(url.searchParams.get("file")).toBe("new.py");
    expect(url.searchParams.get("session_id")).toBe("session-123");
  });

  it("omits session_id when not provided", () => {
    mockLocation("?file=old.py&session_id=stale");
    openNotebookInCurrentTab("new.py");
    const url = assignedUrl();
    expect(url.searchParams.has("session_id")).toBe(false);
  });

  it("preserves the mode param when already present", () => {
    mockLocation("?file=old.py&mode=edit");
    openNotebookInCurrentTab("new.py");
    const url = assignedUrl();
    expect(url.searchParams.get("mode")).toBe("edit");
  });

  it("does not add a mode param when absent", () => {
    mockLocation("?file=old.py");
    openNotebookInCurrentTab("new.py");
    const url = assignedUrl();
    expect(url.searchParams.has("mode")).toBe(false);
  });

  it("does not leak other stale params into the new URL", () => {
    mockLocation("?file=old.py&mode=read&session_id=stale&some=junk");
    openNotebookInCurrentTab("new.py", "fresh-id");
    const url = assignedUrl();
    expect(url.searchParams.get("some")).toBeNull();
    expect(url.searchParams.get("session_id")).toBe("fresh-id");
    expect(url.searchParams.get("mode")).toBe("read");
    expect(url.searchParams.get("file")).toBe("new.py");
  });
});

describe("openNotebookInCurrentTab page-exit transition", () => {
  const originalLocation = window.location;
  const originalMatchMedia = window.matchMedia;
  const assignMock = vi.fn();

  function mockLocation(search: string) {
    Object.defineProperty(window, "location", {
      value: {
        assign: assignMock,
        search,
      },
      writable: true,
    });
  }

  function mockReducedMotion(reduced: boolean) {
    Object.defineProperty(window, "matchMedia", {
      value: (query: string) => ({
        matches: reduced && query === "(prefers-reduced-motion: reduce)",
        media: query,
      }),
      writable: true,
    });
  }

  beforeEach(() => {
    assignMock.mockClear();
    document.documentElement.classList.remove(PAGE_EXIT_CLASS);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.classList.remove(PAGE_EXIT_CLASS);
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
    Object.defineProperty(window, "matchMedia", {
      value: originalMatchMedia,
      writable: true,
    });
  });

  it("dims the page before navigating", () => {
    mockReducedMotion(false);
    mockLocation("?file=old.py");
    openNotebookInCurrentTab("new.py");
    expect(document.documentElement.classList.contains(PAGE_EXIT_CLASS)).toBe(
      true,
    );
    expect(assignMock).toHaveBeenCalledTimes(1);
  });

  it("still dims when matchMedia is unavailable (jsdom)", () => {
    Object.defineProperty(window, "matchMedia", {
      value: undefined,
      writable: true,
    });
    mockLocation("?file=old.py");
    openNotebookInCurrentTab("new.py");
    expect(document.documentElement.classList.contains(PAGE_EXIT_CLASS)).toBe(
      true,
    );
    expect(assignMock).toHaveBeenCalledTimes(1);
  });

  it("does not dim when the user prefers reduced motion, but still navigates", () => {
    mockReducedMotion(true);
    mockLocation("?file=old.py");
    openNotebookInCurrentTab("new.py");
    expect(document.documentElement.classList.contains(PAGE_EXIT_CLASS)).toBe(
      false,
    );
    expect(assignMock).toHaveBeenCalledTimes(1);
  });

  it("removes the dim after a fallback timeout if navigation is cancelled", () => {
    vi.useFakeTimers();
    mockReducedMotion(false);
    mockLocation("?file=old.py");
    openNotebookInCurrentTab("new.py");
    expect(document.documentElement.classList.contains(PAGE_EXIT_CLASS)).toBe(
      true,
    );
    vi.advanceTimersByTime(2000);
    expect(document.documentElement.classList.contains(PAGE_EXIT_CLASS)).toBe(
      false,
    );
  });
});
