/* Copyright 2026 Marimo. All rights reserved. */

import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@/core/state/jotai";
import {
  addLocalComponent,
  deleteLocalComponent,
  localComponentsAtom,
  renameLocalComponent,
} from "../local-components";

describe("local components store", () => {
  beforeEach(() => {
    store.set(localComponentsAtom, []);
  });

  it("adds a component", () => {
    const component = addLocalComponent({
      name: "  My chart  ",
      description: "  A bar chart  ",
      code: "import marimo as mo",
    });

    expect(component.id).toBeTruthy();
    expect(component.name).toBe("My chart");
    expect(component.description).toBe("A bar chart");
    expect(component.code).toBe("import marimo as mo");
    expect(component.createdAt).toBeTypeOf("number");
    expect(store.get(localComponentsAtom)).toEqual([component]);
  });

  it("omits an empty description", () => {
    const component = addLocalComponent({
      name: "chart",
      description: "   ",
      code: "x = 1",
    });
    expect(component.description).toBeUndefined();
  });

  it("renames a component", () => {
    const component = addLocalComponent({ name: "old", code: "x = 1" });
    renameLocalComponent(component.id, "new");
    expect(store.get(localComponentsAtom)).toEqual([
      { ...component, name: "new" },
    ]);
  });

  it("is a no-op when renaming an unknown id", () => {
    const component = addLocalComponent({ name: "keep", code: "x = 1" });
    renameLocalComponent("unknown-id", "new");
    expect(store.get(localComponentsAtom)).toEqual([component]);
  });

  it("deletes a component", () => {
    const a = addLocalComponent({ name: "a", code: "a = 1" });
    const b = addLocalComponent({ name: "b", code: "b = 2" });
    deleteLocalComponent(a.id);
    expect(store.get(localComponentsAtom)).toEqual([b]);
  });

  it("is a no-op when deleting an unknown id", () => {
    const component = addLocalComponent({ name: "keep", code: "x = 1" });
    deleteLocalComponent("unknown-id");
    expect(store.get(localComponentsAtom)).toEqual([component]);
  });
});
