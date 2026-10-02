#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo "🚀 Setting up TenderPulse AI Monorepo Development Environment"
echo "=========================================================="

# 1. Environment file setup
if [ ! -f .env ]; then
  echo "📋 Creating .env from .env.example..."
  cp .env.example .env
fi

# 2. Node & Monorepo dependencies
echo "📦 Installing Node dependencies via npm workspaces..."
npm install

# 3. Python AI Engine setup
if command -v uv &> /dev/null; then
  echo "🐍 uv detected. Setting up Python virtual environment for apps/ai..."
  (cd apps/ai && uv venv && source .venv/bin/activate && uv pip install -r requirements.txt)
elif command -v python3 &> /dev/null; then
  echo "🐍 python3 detected. Setting up venv for apps/ai..."
  (cd apps/ai && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt)
fi

echo "✅ Development environment setup complete!"
echo "Run 'npm run build' to compile all packages."
echo "Run 'docker compose up -d postgres localstack' to start local databases."
