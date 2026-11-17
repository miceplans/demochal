import assert from 'node:assert/strict';
import { test } from 'node:test';
import { composeProjectName, dbPortFor } from './dev-local.mjs';

test('compose project name follows the directory basename (compose default)', () => {
  assert.equal(composeProjectName('/a/b/demochal'), 'demochal');
  assert.equal(composeProjectName('/a/b/demochal-issue-1012'), 'demochal-issue-1012');
  assert.equal(composeProjectName('/a/b/Demo.Chal'), 'demochal');
  assert.equal(composeProjectName('/a/b/...'), 'semochal');
});

test('db port is stable per path and stays out of the default 5432', () => {
  const a = dbPortFor('/a/demochal');
  assert.equal(a, dbPortFor('/a/demochal'));
  assert.notEqual(a, dbPortFor('/a/demochal-990'));
  for (const dir of ['/x', '/y/z', '/a/demochal']) {
    const p = dbPortFor(dir);
    assert.ok(p >= 55000 && p < 56000);
  }
});
