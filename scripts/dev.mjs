#!/usr/bin/env node
// Dev orchestrator that reliably tears down the whole process tree on Ctrl+C.
// Each child runs in its own process group (detached), so killing -pid takes
// down every grandchild (next dev workers, tsc watchers, ...), freeing ports.

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const TASKS = [
  { name: 'server', cmd: 'pnpm', args: ['--filter', './server', 'run', 'dev'] },
  { name: 'front', cmd: 'pnpm', args: ['--filter', './front', 'run', 'dev'] },
]

const children = []
let shuttingDown = false
let forceTimer = null

function spawnTask(task) {
  const child = spawn(task.cmd, task.args, {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: true,
  })
  children.push(child)

  child.on('error', (err) => {
    console.error(`[${task.name}] failed to start:`, err.message)
    shutdown(1)
  })

  child.on('exit', (code) => {
    if (shuttingDown) {
      if (children.every((c) => c.exitCode !== null || c.signalCode !== null || c.killed)) {
        finish()
      }
      return
    }
    console.log(`\n[${task.name}] exited (code ${code ?? 'null'}), stopping the rest...`)
    shutdown(code ?? 1)
  })

  return child
}

function signalGroups(signal) {
  for (const child of children) {
    if (child.pid == null) continue
    try {
      process.kill(-child.pid, signal) // negative pid: the entire process group
    } catch {
      // group already gone
    }
  }
}

function shutdown(exitCode = 130) {
  if (shuttingDown) return
  shuttingDown = true
  pendingExitCode = exitCode
  signalGroups('SIGINT')
  // Escalate if graceful shutdown stalls
  forceTimer = setTimeout(() => {
    signalGroups('SIGKILL')
    setTimeout(finish, 200)
  }, 5000)
}

let pendingExitCode = 130

function finish() {
  if (forceTimer) clearTimeout(forceTimer)
  process.exit(pendingExitCode)
}

process.on('SIGINT', () => {
  if (shuttingDown) {
    signalGroups('SIGKILL')
    setTimeout(finish, 200)
    return
  }
  console.log('\nreceived SIGINT, shutting down...')
  shutdown(130)
})
process.on('SIGTERM', () => shutdown(143))
process.on('SIGHUP', () => shutdown(129))

// 1) one-shot build (replaces the old `predev` hook)
const build = spawn('pnpm', ['--filter', '@semochal/api-client', 'build'], {
  cwd: root,
  env: process.env,
  stdio: ['ignore', 'inherit', 'inherit'],
  detached: true,
})
children.push(build)
build.on('error', (err) => {
  console.error('[api-client build] failed to start:', err.message)
  process.exit(1)
})
build.on('exit', (code) => {
  if (code !== 0) {
    console.error(`[api-client build] failed with code ${code}`)
    process.exit(code ?? 1)
  }
  if (shuttingDown) return
  // 2) start dev servers
  for (const task of TASKS) spawnTask(task)
})
