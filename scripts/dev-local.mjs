#!/usr/bin/env node
// One-command local environment: per-worktree Postgres (Docker) → migrations → `pnpm dev`.
//
//   pnpm dev:local             DB 기동 + 마이그레이션 + front/server 실행
//   pnpm dev:local --reset     이 워크트리의 DB 볼륨을 지우고 처음부터 마이그레이션
//   pnpm dev:local --db-only   DB 기동 + 마이그레이션까지만 (테스트용), DATABASE_URL 출력
//   pnpm dev:local:down        이 워크트리의 컨테이너 정리 (볼륨 유지)
//
// 워크트리마다 compose 프로젝트명과 호스트 포트를 경로에서 파생하므로, 여러 워크트리가
// 서로 다른 마이그레이션 상태의 DB를 동시에 가질 수 있다. 배포(staging/prod) 마이그레이션은
// 여전히 CI가 담당하며, 이 스크립트는 로컬 개발 전용이다.

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, realpathSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const args = new Set(process.argv.slice(2));

export function composeProjectName(dir) {
  // Matches docker compose's default (directory basename) so the primary
  // checkout keeps its existing volume.
  return (
    basename(dir)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .replace(/^[^a-z0-9]+/, '') || 'semochal'
  );
}

export function dbPortFor(dir) {
  const hash = createHash('sha1').update(dir).digest().readUInt16BE(0);
  return 55000 + (hash % 1000);
}

export function resolveDbPort(dir, override = process.env.SEMOCHAL_DB_PORT) {
  return override ?? String(dbPortFor(dir));
}

export function isMainModule(argvPath, moduleUrl) {
  return Boolean(argvPath) && realpathSync(argvPath) === realpathSync(fileURLToPath(moduleUrl));
}

function sh(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, { cwd: root, stdio: 'inherit', ...opts });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    console.error(`[dev:local] failed: ${cmd} ${cmdArgs.join(' ')}`);
    process.exit(res.status ?? 1);
  }
}

function primaryWorktree() {
  const res = spawnSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: root,
    encoding: 'utf8',
  });
  const line = res.stdout?.split('\n').find((l) => l.startsWith('worktree '));
  return line ? line.slice('worktree '.length) : undefined;
}

// New worktrees have no gitignored env files; borrow them from the primary checkout.
function ensureEnvFiles() {
  const primary = primaryWorktree();
  for (const rel of ['server/.env', 'front/.env.local']) {
    const target = join(root, rel);
    if (existsSync(target)) continue;
    const source = primary && join(primary, rel);
    if (source && source !== target && existsSync(source)) {
      copyFileSync(source, target);
      console.log(`[dev:local] ${rel} 없음 → 메인 체크아웃에서 복사`);
    } else {
      console.warn(`[dev:local] ${rel} 없음 — ${rel}.example을 참고해 만들어 주세요`);
    }
  }
}

function main() {
  const project = composeProjectName(root);
  const port = resolveDbPort(root);
  const composeEnv = {
    ...process.env,
    COMPOSE_PROJECT_NAME: project,
    SEMOCHAL_DB_PORT: port,
  };
  const compose = (composeArgs) => sh('docker', ['compose', ...composeArgs], { env: composeEnv });

  if (args.has('--down')) {
    compose(['down']);
    return;
  }

  if (args.has('--reset')) {
    console.log(`[dev:local] ${project} DB 볼륨 초기화`);
    compose(['down', '-v']);
  }

  console.log(`[dev:local] Postgres 기동 (project=${project}, port=${port})`);
  compose(['up', '-d', '--wait', 'db']);

  const databaseUrl = `postgres://semochal:semochal@127.0.0.1:${port}/semochal`;
  const env = { ...process.env, DATABASE_URL: databaseUrl };

  ensureEnvFiles();

  // Same migrator as the compose `migrate` service, run from source so no image build is needed.
  console.log('[dev:local] 마이그레이션 적용');
  sh('pnpm', ['--filter', '@semochal/server', 'exec', 'tsx', 'src/migrate.ts'], { env });

  if (args.has('--db-only')) {
    console.log(`\n[dev:local] 준비 완료. 테스트 시:\n  export DATABASE_URL=${databaseUrl}`);
    return;
  }

  // dev.mjs handles Ctrl+C for its own process tree; just mirror its exit code.
  process.on('SIGINT', () => {});
  const child = spawn('node', ['scripts/dev.mjs'], { cwd: root, env, stdio: 'inherit' });
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 130 : 1)));
}

if (isMainModule(process.argv[1], import.meta.url)) main();
