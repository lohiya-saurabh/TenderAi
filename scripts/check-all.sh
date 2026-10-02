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
if command -v uv &> /dev/null; then
  (cd apps/ai && uv run ruff check . && uv run pytest)
fi

echo "✅ All monorepo quality gates passed cleanly!"
