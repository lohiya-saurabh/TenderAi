#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "🔍 Running Monorepo Quality Gate Checks"
echo "=========================================================="

echo "1. Formatting check..."
npm run format:check || true

echo "2. ESLint across all workspaces..."
npm run lint

echo "3. TypeScript type-checking..."
npm run type-check

echo "4. Automated Test Suites (Vitest)..."
npm test

echo "5. Python AI Service Tests & Linting..."
REPO_ROOT="$(git rev-parse --show-toplevel)"
RUFF_CMD=""
if [ -x "$REPO_ROOT/.venv/bin/ruff" ]; then
  RUFF_CMD="$REPO_ROOT/.venv/bin/ruff"
elif command -v ruff &>/dev/null; then
  RUFF_CMD="ruff"
elif command -v uv &>/dev/null; then
  RUFF_CMD="uv run ruff"
fi

if [ -n "$RUFF_CMD" ]; then
  (cd "$REPO_ROOT/apps/ai" && $RUFF_CMD check . && $RUFF_CMD format --check .)
fi

echo "✅ All monorepo quality gates passed cleanly!"
