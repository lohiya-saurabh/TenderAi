#!/usr/bin/env bash
# Claude Code PostToolUse hook: format the file just edited with the repo's pinned formatter.
# prettier comes from node_modules (package-lock); ruff from apps/ai/.venv (apps/ai/uv.lock), the same
# binary .githooks/pre-commit checks with — never a global install of a different version.
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
file="$(jq -r '.tool_input.file_path // empty')"
[ -f "$file" ] || exit 0
case "$file" in
  "$REPO_ROOT"/apps/ai/*.py)
    ruff="$REPO_ROOT/apps/ai/.venv/bin/ruff"
    [ -x "$ruff" ] || exit 0
    cd "$REPO_ROOT/apps/ai" && "$ruff" check --fix --quiet "$file"; "$ruff" format --quiet "$file"
    ;;
  *.ts | *.tsx | *.js | *.mjs | *.cjs | *.json | *.css | *.md | *.yml | *.yaml | *.html)
    "$REPO_ROOT/node_modules/.bin/prettier" --write --log-level warn --ignore-unknown "$file"
    ;;
esac
exit 0
