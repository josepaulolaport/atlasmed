#!/usr/bin/env bash
# Install AtlasMed git hooks by pointing core.hooksPath at .githooks/.
# Idempotent — safe to run repeatedly.
# Run once per clone / per worktree.

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "${repo_root}"

# Ensure hook scripts are executable.
chmod +x .githooks/pre-commit .githooks/pre-push

# Point git at the tracked hooks dir.
current="$(git config core.hooksPath || true)"
if [[ "${current}" == ".githooks" ]]; then
  echo "✓ core.hooksPath already set to .githooks"
else
  git config core.hooksPath .githooks
  echo "✓ Installed hooks — core.hooksPath = .githooks"
fi

echo
echo "Active hooks:"
ls -1 .githooks/ | sed 's/^/  /'
echo
echo "Test: try 'git checkout main && touch x && git add x && git commit -m x' — should be rejected."
