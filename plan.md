# Multi-Notebook Projects Refactor — Execution Plan

Branch: `feature/multi-notebook-projects` (do NOT merge to main)

## Goal
Shift marimo from "notebook == project" to "project == a folder holding 1..n notebooks",
with fast notebook switching from a new left-rail panel in the notebook UI (Deepnote-style).
Then a full UI polish pass to Hex.tech-level fit and finish.

## Key architecture findings (exploration stage)

### Backend (marimo/_server)
- `NotebookWorkspace` abstraction already exists: `marimo/_server/workspace/` (Single / Directory / Fixed / Empty).
- `SessionManager` (`marimo/_server/session_manager.py`) already hosts multiple sessions; one kernel subprocess per file in EDIT mode.
- File routing: `?file=<key>` on `/` and `/ws`; session header for API calls.
- Home APIs already exist: `/api/home/workspace_files`, `/api/home/running_notebooks`, `/api/home/recent_files`, `/api/home/shutdown_session` (`marimo/_server/api/endpoints/home.py`).
- File explorer APIs exist: `/api/files/*` (`marimo/_server/api/endpoints/file_explorer.py`).
- Policy: one session per file in EDIT mode (`resume_strategies.py`); second tab -> kiosk/RTC.
- Gap: keep-warm session lifecycle on switch, small endpoint/return-shape adjustments, tests.

### Frontend (frontend/src)
- Rail panel registry: `frontend/src/components/editor/chrome/types.ts` (`PanelType`, `PANELS`),
  lazy loaders `chrome/wrapper/lazy-panels.ts`, mapping `chrome/wrapper/app-chrome.tsx` (`SIDEBAR_PANELS`).
- Switching today = new browser tab via `openNotebook()` in `frontend/src/utils/links.ts`.
- File explorer panel already lists workspace tree (`file-tree/file-explorer.tsx`, `requesting-tree.tsx`).
- Filename state: `filenameAtom` (`core/saving/file-state.ts`), `cwdAtom`.
- Session id is a module-level singleton (`core/kernel/session.ts`) => in-place kernel switching is a
  huge refactor; v1 uses same-tab navigation (`location.assign("?file=...&session_id=...")`).

## Contracts (all workers must honor)
- New panel type id: `"notebooks"`; label "Notebooks"; lucide icon `NotebookText`.
- Panel component: `frontend/src/components/editor/chrome/panels/notebook-switcher/notebook-switcher-panel.tsx`,
  named export `NotebookSwitcherPanel`.
- Navigation helper (owned by Worker A4): `openNotebookInCurrentTab(path: string, sessionId?: string)` in
  `frontend/src/utils/links.ts` — same-tab navigation preserving/skipping `session_id` as given.
- Workers do NOT git-commit during the parallel stage; orchestrator commits after integration.

## Stage 1 — Parallel implementation (AgentSwarm, 4 coders)
- A1 Backend_Projects: backend gaps + tests. Files: `marimo/**`, `tests/**` only.
- A2 Chrome_Registry: register `"notebooks"` panel in chrome. Files: `chrome/types.ts`, `chrome/wrapper/*` only.
- A3 Switcher_Panel: the NotebookSwitcherPanel component + data hooks. Files: `chrome/panels/notebook-switcher/**`, `core/network/*` only.
- A4 Switch_Navigation: same-tab nav helper + file-explorer same-tab open. Files: `utils/links.ts`, `file-tree/**` only.

## Stage 2 — Integration & verification (single coder)
- Run `make fe-check`, `make py-check`, targeted frontend/backend tests; fix all failures; commit on the feature branch.

## Stage 3 — UI expert polish (single coder, gated on Stage 2)
- Start dev servers, preview the running UI directly (screenshots via headless browser / browser-control tools),
  iterate on visual polish across the whole project UI to Hex.tech-level quality.
- Re-run checks; commit.

## Stage 4 — Report
- Summarize changes, branch, verification status; do not merge.
