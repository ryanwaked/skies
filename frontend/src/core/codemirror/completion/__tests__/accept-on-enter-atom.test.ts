/* Copyright 2026 Marimo. All rights reserved. */
import { createStore } from "jotai";
import { beforeEach, describe, expect, it } from "vitest";
import { acceptCompletionOnEnterAtom } from "../accept-on-enter-atom";

describe("acceptCompletionOnEnterAtom", () => {
  beforeEach(() => {
    localStorage.removeItem("marimo:accept-completion-on-enter");
  });

  it("defaults to false so Enter inserts a newline and Tab accepts", () => {
    // Regression guard: accepting completions on Enter is unintuitive because
    // it hijacks Enter while the popup is open. Tab accepts instead (cm.ts).
    const store = createStore();
    expect(store.get(acceptCompletionOnEnterAtom)).toBe(false);
  });
});
