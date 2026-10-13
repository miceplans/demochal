#!/usr/bin/env node
/**
 * Unit tests for scripts/secret-scan.mjs. The allowlist must be tested against
 * the matched secret value only — a line that mentions `process.env` anywhere
 * (fallback, comment) must not exempt a hardcoded credential on the same line.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { scanLine } from './secret-scan.mjs';

test('flags a hardcoded credential even when the same line references process.env', () => {
  assert.deepEqual(
    scanLine("const apiKey = 'sk-live-realkey1234567890'; // fallback: process.env.API_KEY"),
    ['credential-assignment'],
  );
  assert.deepEqual(
    scanLine("const token = process.env.TOKEN || 'ghp_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0'"),
    ['github-token'],
  );
  assert.deepEqual(
    scanLine("const SECRET = process.env.SECRET, leaked = '-----BEGIN OPENSSH PRIVATE KEY-----';"),
    ['private-key'],
  );
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
  assert.deepEqual(scanLine("const password = 'hunter2-hunter2-hunter2';"), [
    'credential-assignment',
  ]);
  assert.deepEqual(scanLine('AWS_SECRET_ACCESS_KEY=abcd1234efgh5678ijkl9012mnop3456'), [
    'dotenv-credential',
  ]);
  assert.deepEqual(scanLine("const key = '-----BEGIN RSA PRIVATE KEY-----';"), ['private-key']);
  assert.deepEqual(scanLine('const id = "AKIA1234567890ABCDEF";'), ['aws-access-key']);
  assert.deepEqual(scanLine('GLM_API_KEY=abcdef1234567890fedc0987'), ['dotenv-credential']);
});
