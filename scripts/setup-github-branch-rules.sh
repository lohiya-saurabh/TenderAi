#!/usr/bin/env bash
# ==============================================================================
# TenderPulse AI — GitHub Branch Protection & Policy Setup Script
#
# Enforces:
# 1. Direct pushes to 'main' are completely blocked.
# 2. All changes to 'main' must come via Pull Request.
# 3. Pull requests to 'main' MUST originate strictly from 'develop'.
# 4. All CI checks (Lint, Typecheck, Unit Tests, AI Eval, Security) must pass.
# ==============================================================================

set -euo pipefail

# Check for gh CLI
if ! command -v gh >/dev/null 2>&1; then
  echo "❌ Error: GitHub CLI ('gh') is required. Install via 'brew install gh' or download from https://cli.github.com"
  exit 1
fi

# Ensure user is authenticated
if ! gh auth status >/dev/null 2>&1; then
  echo "⚠️ You must authenticate to GitHub first. Running 'gh auth login'..."
  gh auth login
fi

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
if [ -z "$REPO" ]; then
  echo -n "Enter GitHub repository (owner/repo, e.g. belikesaurabh/TenderAi): "
  read -r REPO
fi

echo "================================================================="
echo "Configuring Branch Protection for: $REPO (branch: main)"
echo "================================================================="

# Create or verify that 'develop' branch exists remotely
if ! git rev-parse --verify origin/develop >/dev/null 2>&1; then
  echo "ℹ️ Creating and pushing 'develop' branch from current commit..."
  git branch develop 2>/dev/null || true
  git push origin develop 2>/dev/null || echo "⚠️ Could not push develop branch automatically. Please push develop manually."
fi

# Apply Branch Protection via GitHub REST API
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO/branches/main/protection" \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "0. Enforce Branch Policy (develop -> main)",
      "1. Lint & Formatting",
      "2. TypeScript & Python Typecheck",
      "3. Unit & Integration Test Suites",
      "4. AI Evaluation & Security Regressions",
      "5. Security & Vulnerability Audits"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false
}
EOF

echo "================================================================="
echo "✅ Branch Protection successfully enabled on 'main' for $REPO!"
echo ""
echo "Policies active:"
echo "  1. Direct pushes to 'main' are BLOCKED."
echo "  2. Pull Requests into 'main' are REQUIRED."
echo "  3. Pull Requests must pass '0. Enforce Branch Policy' (requires source=develop)."
echo "  4. All quality, unit test, and AI evaluation gates must pass."
echo "================================================================="
