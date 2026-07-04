/* Copyright 2026 Marimo. All rights reserved. */

import { atomWithStorage } from "jotai/utils";
import { z } from "zod";
import { store } from "@/core/state/jotai";
import { adaptForLocalStorage } from "@/utils/storage/jotai";
import { generateUUID } from "@/utils/uuid";

/**
 * A "local component": a named, reusable snippet of cell code, persisted to
 * localStorage. This is a frontend-only v1 of Hex-style components — there is
 * no backend storage, so components are scoped to the browser.
 */
export interface LocalComponent {
  id: string;
  name: string;
  description?: string;
  code: string;
  createdAt: number;
}

const LocalComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  code: z.string(),
  createdAt: z.number(),
});

const localComponentsStorage = adaptForLocalStorage<
  LocalComponent[],
  LocalComponent[]
>({
  toSerializable: (v) => v,
  // Throwing on invalid data falls back to the initial value.
  fromSerializable: (saved) => z.array(LocalComponentSchema).parse(saved),
});

export const localComponentsAtom = atomWithStorage<LocalComponent[]>(
  "marimo:local-components",
  [],
  localComponentsStorage,
  { getOnInit: true },
);

/**
 * Save a new component. Returns the created component.
 */
export function addLocalComponent(opts: {
  name: string;
  description?: string;
  code: string;
}): LocalComponent {
  const description = opts.description?.trim();
  const component: LocalComponent = {
    id: generateUUID(),
    name: opts.name.trim(),
    description: description || undefined,
    code: opts.code,
    createdAt: Date.now(),
  };
  store.set(localComponentsAtom, (prev) => [...prev, component]);
  return component;
}

/**
 * Rename an existing component. No-op if the id is unknown.
 */
export function renameLocalComponent(id: string, name: string): void {
  store.set(localComponentsAtom, (prev) =>
    prev.map((component) =>
      component.id === id ? { ...component, name: name.trim() } : component,
    ),
  );
}

/**
 * Delete a component. No-op if the id is unknown.
 */
export function deleteLocalComponent(id: string): void {
  store.set(localComponentsAtom, (prev) =>
    prev.filter((component) => component.id !== id),
  );
}
