/* Copyright 2026 Marimo. All rights reserved. */
import { describe, expect, it, vi } from "vitest";
import { resolveViewMode } from "../packages-panel";
import {
  focusPackagesInput,
  openPackageManager,
  PACKAGES_INPUT_ID,
} from "../packages-utils";

describe("resolveViewMode", () => {
  it("defaults to tree when the tree is supported", () => {
    expect(resolveViewMode(null, true)).toBe("tree");
  });

  it("defaults to list when the tree is unsupported", () => {
    expect(resolveViewMode(null, false)).toBe("list");
  });

  it("always honors an explicit list selection", () => {
    expect(resolveViewMode("list", true)).toBe("list");
    expect(resolveViewMode("list", false)).toBe("list");
  });

  it("falls back to list when tree is selected but unsupported", () => {
    expect(resolveViewMode("tree", false)).toBe("list");
  });

  it("honors an explicit tree selection when supported", () => {
    expect(resolveViewMode("tree", true)).toBe("tree");
  });
});

describe("focusPackagesInput", () => {
  it("focuses the input with the packages input id", async () => {
    const input = document.createElement("input");
    input.id = PACKAGES_INPUT_ID;
    document.body.append(input);

    focusPackagesInput();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(document.activeElement).toBe(input);
    input.remove();
  });

  it("does nothing when the input is absent", async () => {
    focusPackagesInput();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(document.activeElement).not.toBe(`#${PACKAGES_INPUT_ID}`);
  });
});

describe("openPackageManager", () => {
  it("opens the packages panel", () => {
    const openApplication = vi.fn();
    openPackageManager({ openApplication });
    expect(openApplication).toHaveBeenCalledWith("packages");
  });

  it("focuses the install input after opening", async () => {
    const input = document.createElement("input");
    input.id = PACKAGES_INPUT_ID;
    document.body.append(input);

    openPackageManager({ openApplication: vi.fn() });
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(document.activeElement).toBe(input);
    input.remove();
  });
});
