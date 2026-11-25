#!/usr/bin/env node
/**
 * Unit tests for scripts/secret-scan.mjs. The allowlist must be tested against
 * the matched secret value only — a line that mentions `process.env` anywhere
 * (fallback, comment) must not exempt a hardcoded credential on the same line.
 *
 * Credential-shaped fixtures are assembled at runtime so the literal patterns
 * never appear contiguously in this source: the repo's own secret-scan reads
 * added diff lines, and committing raw fixtures would make the scan flag its
 * own test file.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { isSensitivePath, scanLine } from './secret-scan.mjs';

const SK_LIVE_KEY = ['sk-live', 'realkey1234567890'].join('-');
const GHP_TOKEN = ['ghp_', 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0'].join('');
const OPENSSH_KEY = ['-----BEGIN ', 'OPENSSH PRIVATE KEY-----'].join('');
const RSA_KEY = ['-----BEGIN RSA ', 'PRIVATE KEY-----'].join('');
const REUSED_PASSWORD = ['hunter2', 'hunter2', 'hunter2'].join('-');
const AWS_SECRET_VALUE = ['abcd1234efgh', '5678ijkl9012mnop3456'].join('');
const AWS_ACCESS_KEY_ID = ['AKIA', '1234567890ABCDEF'].join('');
const GLM_KEY_VALUE = ['abcdef1234567890', 'fedc0987'].join('');

test('flags a hardcoded credential even when the same line references process.env', () => {
  assert.deepEqual(
    scanLine("const apiKey = '" + SK_LIVE_KEY + "'; // fallback: process.env.API_KEY"),
    ['credential-assignment'],
  );
  assert.deepEqual(scanLine("const token = process.env.TOKEN || '" + GHP_TOKEN + "'"), [
    'github-token',
  ]);
  assert.deepEqual(scanLine("const SECRET = process.env.SECRET, leaked = '" + OPENSSH_KEY + "';"), [
    'private-key',
  ]);
});

test('keeps legitimate process.env references clean', () => {
  assert.deepEqual(scanLine('const apiKey = process.env.API_KEY;'), []);
  assert.deepEqual(scanLine('const url = `${process.env.API_URL}/v1`;'), []);
  assert.deepEqual(scanLine('GLM_API_KEY=process.env.GLM_API_KEY'), []);
});

test('keeps placeholder and example values clean', () => {
  assert.deepEqual(scanLine("const apiKey = 'example-api-key-12345';"), []);
  assert.deepEqual(scanLine('GLM_API_KEY=your-glm-api-key-here'), []);
  assert.deepEqual(scanLine("password: 'change-me-please'"), []);
  assert.deepEqual(scanLine("const token = 'test-key-abcdef123';"), []);
});

test('flags hardcoded credentials without any env reference', () => {
  assert.deepEqual(scanLine("const password = '" + REUSED_PASSWORD + "';"), [
    'credential-assignment',
  ]);
  assert.deepEqual(scanLine('AWS_SECRET_ACCESS_KEY=' + AWS_SECRET_VALUE), ['dotenv-credential']);
  assert.deepEqual(scanLine("const key = '" + RSA_KEY + "';"), ['private-key']);
  assert.deepEqual(scanLine('const id = "' + AWS_ACCESS_KEY_ID + '";'), ['aws-access-key']);
  assert.deepEqual(scanLine('GLM_API_KEY=' + GLM_KEY_VALUE), ['dotenv-credential']);
});

test('flags settings and key files by path, but not their templates', () => {
  for (const path of [
    '.env',
    'server/.env.local',
    'infra/terraform/production.tfvars',
    'infra/terraform/production.auto.tfvars.json',
    'infra/terraform/terraform.tfstate',
    'infra/terraform/terraform.tfstate.backup',
    'certs/client.p12',
  ])
    assert.equal(isSensitivePath(path), true, path);
  for (const path of [
    'server/.env.example',
    'infra/terraform/production.tfvars.example',
    'infra/terraform/variables.tf',
    'server/certs/global-bundle.pem',
    'server/src/config/env.ts',
  ])
    assert.equal(isSensitivePath(path), false, path);
});

// Runs the CLI in a throwaway repository: returns the exit code and stderr.
function withRepo(run) {
  const cwd = mkdtempSync(join(tmpdir(), 'secret-scan-'));
  const git = (...args) => {
    const result = spawnSync(
      'git',
      [
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@example.com',
        '-c',
        'commit.gpgsign=false',
        ...args,
      ],
      { cwd, encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
  };
  const commit = (path, content) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
    git('add', '-f', path);
    git('commit', '-qm', path);
  };
  const script = fileURLToPath(new URL('./secret-scan.mjs', import.meta.url));
  const scan = (base) =>
    spawnSync(process.execPath, [script, '--base', base], { cwd, encoding: 'utf8' });
  try {
    git('init', '-q', '-b', 'main');
    commit('README.md', 'base');
    git('tag', 'base');
    run({ git, commit, scan });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('fails on a committed tfvars file without printing its contents', () => {
  withRepo(({ commit, scan }) => {
    commit('infra/production.tfvars', 'environment = "hidden-value"');
    const result = scan('base');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /infra\/production\.tfvars:0 \[sensitive-file\]/);
    assert.doesNotMatch(result.stderr, /hidden-value/);
  });
});

test('fails when a sensitive file was added and removed again before the scan', () => {
  withRepo(({ git, commit, scan }) => {
    commit('infra/production.tfvars', 'environment = "x"');
    git('rm', '-q', 'infra/production.tfvars');
    git('commit', '-qm', 'remove');
    assert.equal(scan('base').status, 1);
  });
});

test('passes for templates and ordinary files, and fails closed on a bad base', () => {
  withRepo(({ commit, scan }) => {
    commit('infra/production.tfvars.example', 'environment = "x"');
    commit('src/app.ts', 'export {};');
    assert.equal(scan('base').status, 0);
    assert.notEqual(scan('no-such-ref').status, 0);
  });
});
