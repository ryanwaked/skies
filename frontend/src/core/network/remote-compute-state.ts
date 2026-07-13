/* Copyright 2026 Marimo. All rights reserved. */

import { atom } from "jotai";

/**
 * The name of the remote-compute target this notebook's kernel is currently
 * running on, or `null` for the local machine.
 *
 * This is UI-only state: the authoritative override lives server-side in the
 * SessionManager (`_remote_compute_overrides`). Because a notebook is edited
 * in a single browser tab, a module-level atom is enough to drive the "Run
 * on" menu's checkmark. It defaults to `null` (local) on load — reloading the
 * page after picking a target does not currently restore the checkmark, but
 * the kernel does still run on the chosen target until switched back.
 */
export const remoteComputeTargetAtom = atom<string | null>(null);
