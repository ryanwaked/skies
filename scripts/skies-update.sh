#!/bin/sh

# Skies auto-update.
#
# Run by the Skies menu-bar app before it starts the notebook server (and on
# "Restart Server"). Two steps, both safe to run on every launch:
#
#   1. Fast-forward `main` from the `fork` remote — but only when it is
#      unambiguously safe: on the `main` branch, a clean working tree, and a
#      true fast-forward. Never merges, never rebases, never touches local edits.
#   2. Rebuild the frontend when the checked-out commit changed since the last
#      successful build. A full rebuild is ~30s, so it is skipped when nothing
#      moved; when nothing new is on `main`, this whole script is a quick no-op.
#
# The build stamp is written only on a successful build, so a failed build is
# retried on the next launch and the app keeps serving the previous `_static`
# in the meantime. The script always exits 0 — the app should launch even if
# updating fails (offline, no toolchain, etc.).

set -u

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO=$(dirname -- "$HERE")
cd "$REPO" || exit 0

STAMP="$REPO/.venv/.skies-built-commit"

# A Finder-launched .app inherits a minimal PATH, so Node/pnpm (installed via
# nvm) and Homebrew tools are not found by default. Add the likely locations.
# Each entry is prepended, so the LAST one wins: nvm is listed last to keep
# Node and pnpm from the same (newest) nvm install rather than mixing sources.
for d in /opt/homebrew/bin /usr/local/bin "$HOME"/.local/bin \
         "$HOME"/Library/pnpm "$HOME"/.nvm/versions/node/*/bin; do
  [ -d "$d" ] && PATH="$d:$PATH"
done
export PATH

# Never let git block on an interactive auth prompt — the app would hang.
export GIT_TERMINAL_PROMPT=0

# 1) Fast-forward from fork/main when it is safe to do so.
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ "$branch" = "main" ] && [ -z "$(git status --porcelain 2>/dev/null)" ]; then
  if git fetch --quiet fork main 2>/dev/null; then
    git merge --ff-only --quiet fork/main 2>/dev/null || true
  fi
fi

# 2) Rebuild the frontend only when HEAD moved since the last build.
head=$(git rev-parse HEAD 2>/dev/null || echo "")
built=$(cat "$STAMP" 2>/dev/null || echo "")
if [ -n "$head" ] && [ "$head" != "$built" ]; then
  if "$REPO/scripts/buildfrontend.sh"; then
    printf '%s\n' "$head" >"$STAMP"
  fi
fi

exit 0
