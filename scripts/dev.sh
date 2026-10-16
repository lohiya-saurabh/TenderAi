#!/usr/bin/env bash
set -e

# TenderPulse AI — Start Frontend & Backend Development Servers
# Colors for console output
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "\n${CYAN}==============================================================${NC}"
echo -e "${GREEN}🚀  Starting TenderPulse AI (Backend API + Frontend Web)  🚀${NC}"
echo -e "${CYAN}==============================================================${NC}\n"

# 1. Ensure packages and API are compiled, and logs directory exists
echo -e "${BLUE}📦 Building packages and compiling API server...${NC}"
mkdir -p logs
npm run build -w @tenderpulse/shared-types
npm run build -w @tenderpulse/ui
npm run build -w @tenderpulse/api

# Function to kill child processes on exit (Ctrl+C)
cleanup() {
  echo -e "\n\n${YELLOW}🛑 Shutting down TenderPulse AI servers...${NC}"
  kill $AI_PID $TSC_PID $TSCALIAS_PID $API_PID 2>/dev/null || true
  sleep 0.3
  kill -9 $AI_PID $TSC_PID $TSCALIAS_PID $API_PID 2>/dev/null || true
  kill 0 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Pre-flight: Clean up any stale/orphaned processes on ports 8000, 3000, 5173
for port in 8000 3000 5173; do
  pids=$(lsof -ti:$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo -e "${YELLOW}🧹 Clearing stale process on port $port (PID: $pids)...${NC}"
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
done

# 2. Start FastAPI AI Worker on Port 8000
echo -e "${GREEN}🧠 Starting FastAPI AI Worker on http://localhost:8000...${NC}"
./apps/ai/.venv/bin/uvicorn tenderpulse_ai.main:app --port 8000 --app-dir apps/ai/src --reload --reload-dir apps/ai/src &
AI_PID=$!

# 3. Start TypeScript Watcher & Backend API Server on Port 3000
echo -e "${BLUE}👀 Starting TypeScript compiler in watch mode...${NC}"
npx tsc -w --preserveWatchOutput -p apps/api/tsconfig.json &
TSC_PID=$!
npx tsc-alias -w -p apps/api/tsconfig.json &
TSCALIAS_PID=$!

echo -e "${GREEN}🌐 Starting Backend API on http://localhost:3000...${NC}"
node scripts/watch-api.js &
API_PID=$!

# Wait a moment for API to bind to port
sleep 1

# 3. Print Demo Login Credentials
echo -e "\n${CYAN}--------------------------------------------------------------${NC}"
echo -e "${YELLOW}🔑 DEMO LOGIN CREDENTIALS${NC}"
echo -e "${CYAN}--------------------------------------------------------------${NC}"
echo -e "  ${GREEN}1. Bid Manager (Full Access):${NC}"
echo -e "     Email:    ${BLUE}bidmanager@acme.com${NC}"
echo -e "     Password: ${BLUE}Password123!${NC}"
echo -e ""
echo -e "  ${GREEN}2. Compliance Officer (Review & Verification):${NC}"
echo -e "     Email:    ${BLUE}compliance@acme.com${NC}"
echo -e "     Password: ${BLUE}Password123!${NC}"
echo -e ""
echo -e "  ${GREEN}3. Auditor (Read-Only Audit Trail):${NC}"
echo -e "     Email:    ${BLUE}auditor@acme.com${NC}"
echo -e "     Password: ${BLUE}Password123!${NC}"
echo -e "${CYAN}--------------------------------------------------------------${NC}\n"

# 4. Start Frontend Vite Dev Server on Port 5173
echo -e "${GREEN}💻 Starting Frontend Vite Server on http://localhost:5173...${NC}\n"
npm run dev -w @tenderpulse/web
