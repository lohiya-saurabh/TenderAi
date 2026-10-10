#!/usr/bin/env node
/**
 * Isolated file-watcher runner for TenderPulse NestJS API server.
 *
 * Why this exists:
 * Native `node --watch` automatically monitors all files touched by the running process.
 * Because embedded PGlite (PostgreSQL) continuously writes WAL logs and cache files into
 * `./data/postgres/` during runtime, native `node --watch` falsely flags those database writes
 * as source changes and triggers an infinite restart loop.
 *
 * This runner strictly watches compiled files (*.js, *.json) in `apps/api/dist`, debounces
 * compiler output batches from `tsc -w`, and safely recycles the Node process without port collisions.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'apps/api/dist');
const envFile = path.join(rootDir, '.env');

let childProcess = null;
let restartDebounceTimer = null;
let isShuttingDown = false;
let isRestarting = false;

function parseEnvFile(filePath) {
  const envVars = {};
  if (!fs.existsSync(filePath)) return envVars;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      envVars[key] = val;
    }
  }
  return envVars;
}

function launchApiServer() {
  if (isShuttingDown) return;

  const nodeArgs = [];
  if (fs.existsSync(envFile)) {
    nodeArgs.push(`--env-file=${envFile}`);
  }
  nodeArgs.push(path.join(distDir, 'main.js'));

  const fileEnv = parseEnvFile(envFile);
  const childEnv = { ...process.env, ...fileEnv };

  childProcess = spawn('node', nodeArgs, {
    cwd: rootDir,
    stdio: 'inherit',
    env: childEnv,
  });

  childProcess.on('exit', (code, signal) => {
    childProcess = null;
    if (isRestarting) {
      isRestarting = false;
      // Previous instance exited cleanly; boot the new instance now
      launchApiServer();
    } else if (!isShuttingDown && code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
      console.warn(`[WatchAPI] API process exited with code ${code}. Waiting for next TypeScript compilation...`);
    }
  });
}

function restartApiServer() {
  if (isShuttingDown) return;

  if (childProcess) {
    isRestarting = true;
    childProcess.kill('SIGTERM');

    // Force-kill fallback if process does not exit within 2s (e.g., stuck on DB lock)
    const forceKillTimer = setTimeout(() => {
      if (childProcess) {
        console.warn('[WatchAPI] Process did not terminate within 2s, force killing (SIGKILL)...');
        childProcess.kill('SIGKILL');
      }
    }, 2000);

    childProcess.once('exit', () => {
      clearTimeout(forceKillTimer);
    });
  } else {
    launchApiServer();
  }
}

// Initial boot
launchApiServer();

// Watch compiled distribution folder
if (fs.existsSync(distDir)) {
  const watcher = fs.watch(distDir, { recursive: true }, (eventType, filename) => {
    if (isShuttingDown || !filename) return;

    // Only restart on compiled application code or manifest changes
    if (!filename.endsWith('.js') && !filename.endsWith('.json')) return;

    if (restartDebounceTimer) {
      clearTimeout(restartDebounceTimer);
    }

    restartDebounceTimer = setTimeout(() => {
      console.log(`\n🔄 [WatchAPI] Recompilation detected in ${filename}. Restarting API server...`);
      restartApiServer();
    }, 350);
  });

  watcher.on('error', (err) => {
    console.error('[WatchAPI] Watcher error:', err);
  });
} else {
  console.warn(`[WatchAPI] Directory ${distDir} does not exist yet. Ensure tsc has compiled the project.`);
}

function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  if (restartDebounceTimer) clearTimeout(restartDebounceTimer);
  if (childProcess) {
    childProcess.kill('SIGTERM');
  }
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
