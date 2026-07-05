/* Copyright 2026 Marimo. All rights reserved. */

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DynamicFavicon } from "../dynamic-favicon";

// The component reads the error count via useAtomValue(cellErrorCount).
// Mock jotai's useAtomValue to return a controllable value for our atom and
// delegate to the real hook for everything else.
const { errorCountSpy, mockCellErrorCountAtom, setErrorCount } = vi.hoisted(
  () => {
    const { atom } = require("jotai") as typeof import("jotai");
    const spy = { current: 0 };
    const a = atom(0);
    return {
      errorCountSpy: spy,
      mockCellErrorCountAtom: a,
      setErrorCount: (count: number) => {
        spy.current = count;
      },
    };
  },
);

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return {
    ...actual,
    useAtomValue: (anAtom: Parameters<typeof actual.useAtomValue>[0]) =>
      anAtom === mockCellErrorCountAtom
        ? errorCountSpy.current
        : actual.useAtomValue(anAtom),
  };
});

vi.mock("@/core/cells/cells", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    cellErrorCount: mockCellErrorCountAtom,
  };
});

describe("DynamicFavicon", () => {
  let favicon: HTMLLinkElement;

  beforeEach(() => {
    // Mock favicon element
    favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.href = "./favicon.ico";
    document.head.append(favicon);

    // Mock document.hasFocus
    vi.spyOn(document, "hasFocus").mockReturnValue(true);

    // No errors by default
    setErrorCount(0);
  });

  afterEach(() => {
    favicon.remove();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("should update favicon when running state changes", async () => {
    render(<DynamicFavicon isRunning={true} />);

    // Wait for async favicon update
    await new Promise((resolve) => setTimeout(resolve, 0));

    const faviconElement =
      document.querySelector<HTMLLinkElement>("link[rel~='icon']")!;
    expect(faviconElement.href.endsWith("circle-play.ico")).toBe(true);
  });

  it("should show success favicon when run completes without errors", async () => {
    const { rerender } = render(<DynamicFavicon isRunning={true} />);

    // Wait for the running favicon to be set
    await new Promise((resolve) => setTimeout(resolve, 0));

    rerender(<DynamicFavicon isRunning={false} />);

    // Wait for async favicon update
    await new Promise((resolve) => setTimeout(resolve, 0));

    const faviconElement =
      document.querySelector<HTMLLinkElement>("link[rel~='icon']")!;
    expect(faviconElement.href.endsWith("circle-check.ico")).toBe(true);
  });

  it("should show error favicon when run completes with errors", async () => {
    setErrorCount(1);

    const { rerender } = render(<DynamicFavicon isRunning={true} />);

    // Wait for the running favicon to be set
    await new Promise((resolve) => setTimeout(resolve, 0));

    rerender(<DynamicFavicon isRunning={false} />);

    // Wait for async favicon update
    await new Promise((resolve) => setTimeout(resolve, 0));

    const faviconElement =
      document.querySelector<HTMLLinkElement>("link[rel~='icon']")!;
    expect(faviconElement.href.endsWith("circle-x.ico")).toBe(true);
  });

  it("should not reset favicon when not in focus", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    vi.useFakeTimers();

    const { rerender } = render(<DynamicFavicon isRunning={true} />);

    // Wait for the running favicon to be set
    await vi.advanceTimersByTimeAsync(0);

    rerender(<DynamicFavicon isRunning={false} />);

    // Wait for async favicon update
    await vi.advanceTimersByTimeAsync(0);

    const faviconElement =
      document.querySelector<HTMLLinkElement>("link[rel~='icon']")!;
    expect(faviconElement.href.endsWith("circle-check.ico")).toBe(true);

    // Advance timers beyond the 3-second reset timeout
    await vi.advanceTimersByTimeAsync(3000);

    // Favicon should still be the success one since document is not in focus
    expect(faviconElement.href.endsWith("circle-check.ico")).toBe(true);
  });

  it("should create favicon link if none exists", () => {
    favicon.remove();
    render(<DynamicFavicon isRunning={true} />);

    const newFavicon = document.querySelector("link[rel~='icon']");
    expect(newFavicon).not.toBeNull();
  });

  describe("notifications", () => {
    beforeEach(() => {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
      // @ts-expect-error ok in tests
      global.Notification = vi.fn();
      // @ts-expect-error ok in tests
      global.Notification.permission = "granted";
    });

    it("should send success notification when run completes without errors", () => {
      // @ts-expect-error ok in tests
      global.Notification = vi.fn().mockImplementation((title, options) => {
        expect(title).toBe("Execution completed");
        expect(options).toEqual({
          body: "Your notebook run completed successfully.",
          icon: "/src/assets/circle-check.ico",
        });
      });
      // @ts-expect-error ok in tests
      global.Notification.permission = "granted";

      const { rerender } = render(<DynamicFavicon isRunning={true} />);
      rerender(<DynamicFavicon isRunning={false} />);
    });

    it("should send error notification when run completes with errors", () => {
      setErrorCount(1);

      // @ts-expect-error ok in tests
      global.Notification = vi.fn().mockImplementation((title, options) => {
        expect(title).toBe("Execution failed");
        expect(options).toEqual({
          body: "Your notebook run encountered 1 error(s).",
          icon: "/src/assets/circle-x.ico",
        });
      });
      // @ts-expect-error ok in tests
      global.Notification.permission = "granted";

      const { rerender } = render(<DynamicFavicon isRunning={true} />);
      rerender(<DynamicFavicon isRunning={false} />);
    });

    it("should not send notification when document is visible", () => {
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
      const { rerender } = render(<DynamicFavicon isRunning={true} />);
      rerender(<DynamicFavicon isRunning={false} />);

      expect(Notification).not.toHaveBeenCalled();
    });

    it("should request permission if not granted", () => {
      // @ts-expect-error ok in tests
      global.Notification.permission = "default";
      global.Notification.requestPermission = vi
        .fn()
        .mockResolvedValue("granted");

      const { rerender } = render(<DynamicFavicon isRunning={true} />);
      rerender(<DynamicFavicon isRunning={false} />);

      // oxlint-disable-next-line typescript/unbound-method
      expect(Notification.requestPermission).toHaveBeenCalled();
    });
  });
});
