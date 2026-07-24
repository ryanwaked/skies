/* Copyright 2026 Marimo. All rights reserved. */
import { describe, expect, it } from "vitest";
import { PANEL_MAP, PANELS } from "../types";

describe("notebooks panel registration", () => {
  it("registers a sidebar descriptor for the notebooks panel", () => {
    const panel = PANEL_MAP.get("notebooks");
    expect(panel).toBeDefined();
    expect(panel?.label).toBe("Notebooks");
    expect(panel?.defaultSection).toBe("sidebar");
    expect(panel?.hidden).toBeFalsy();
  });

  it("positions the notebooks panel near the top of the rail, before files", () => {
    const order = PANELS.map((p) => p.type);
    expect(order.indexOf("notebooks")).toBeGreaterThan(order.indexOf("search"));
    expect(order.indexOf("notebooks")).toBeLessThan(order.indexOf("files"));
  });
});
