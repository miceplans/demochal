#!/usr/bin/env node
// Dev orchestrator that reliably tears down the whole process tree on Ctrl+C.
// Each child runs in its own process group (detached), so killing -pid takes
// down every grandchild (next dev workers, tsc watchers, ...), freeing ports.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const TASKS = [
  { name: 'server', cmd: 'pnpm', args: ['--filter', './server', 'run', 'dev'] },
  { name: 'front', cmd: 'pnpm', args: ['--filter', './front', 'run', 'dev'] },
];

const children = [];
let shuttingDown = false;
let pendingExitCode = 130;
let forceTimer = null;

function allExited() {
  return children.every((c) => c.exitCode !== null || c.signalCode !== null);
}

function signalGroups(signal) {
  for (const child of children) {
    if (child.pid == null) continue;
    try {
      process.kill(-child.pid, signal); // negative pid: the entire process group
    } catch {
      // group already gone
    }
  }
}

function shutdown(exitCode, signal = 'SIGINT') {
  if (shuttingDown) return;
  shuttingDown = true;
  if (exitCode != null) pendingExitCode = exitCode;
  signalGroups(signal);
  if (allExited()) {
    finish();
    return;
  }
  // Escalate if graceful shutdown stalls
  forceTimer = setTimeout(() => {
    signalGroups('SIGKILL');
    forceTimer = setTimeout(finish, 200);
  }, 5000);
}

function finish() {
  if (forceTimer) clearTimeout(forceTimer);
  process.exit(pendingExitCode);
}

function run(name, cmd, args, onExit) {
  const child = spawn(cmd, args, {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: true,
  });
  children.push(child);

  child.on('error', (err) => {
    console.error(`[${name}] failed to start: ${err.message}`);
    shutdown(1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      if (allExited()) finish();
      return;
    }
    onExit(code, signal);
  });
}

function startTask(task) {
  run(task.name, task.cmd, task.args, (code) => {
    console.log(`\n[${task.name}] exited (code ${code ?? 'null'}), stopping the rest...`);
    shutdown(code ?? 1);
  });
}

process.on('SIGINT', () => {
  if (shuttingDown) {
    if (forceTimer) clearTimeout(forceTimer);
    signalGroups('SIGKILL');
    forceTimer = setTimeout(finish, 200);
    return;
  }
  console.log('\nreceived SIGINT, shutting down...');
  shutdown(130);
});
process.on('SIGTERM', () => shutdown(143, 'SIGTERM'));
process.on('SIGHUP', () => shutdown(129, 'SIGHUP'));
process.on('uncaughtException', (err) => {
  console.error('dev runner crashed:', err);
  shutdown(1);
});
process.on('unhandledRejection', (err) => {
  console.error('dev runner crashed:', err);
  shutdown(1);
});

// Runs a one-shot step before the dev servers start; any failure aborts startup.
function runOnce(name, cmd, args, next) {
  run(name, cmd, args, (code, signal) => {
    if (signal || code !== 0) {
      console.error(`[${name}] failed (code ${code ?? 'null'}, signal ${signal ?? 'none'})`);
      shutdown(code ?? 1);
      return;
    }
    next();
  });
}

// 1) one-shot build (replaces the old `predev` hook)
runOnce('api-client build', 'pnpm', ['--filter', '@semochal/api-client', 'build'], () => {
  // 2) DB migrations — fail fast rather than serving against a stale local schema
  runOnce('db migrate', 'pnpm', ['--filter', '@semochal/server', 'run', 'db:migrate'], () => {
    // 3) start dev servers
    for (const task of TASKS) startTask(task);
  });
});
