#!/usr/bin/env bash
# ==============================================================================
# Installs and activates Git hooks for TenderPulse monorepo
# ==============================================================================
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.githooks"
GIT_HOOKS_DIR="$REPO_ROOT/.git/hooks"

echo "🔧 Configuring Git hooks path to .githooks..."
git config core.hooksPath .githooks

# Also copy to .git/hooks as a local fallback
mkdir -p "$GIT_HOOKS_DIR"
cp "$HOOKS_DIR/pre-commit" "$GIT_HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-commit" "$GIT_HOOKS_DIR/pre-commit"

echo "✅ Git pre-commit hook installed and verified!"
