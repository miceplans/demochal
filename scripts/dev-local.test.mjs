import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { composeProjectName, dbPortFor, isMainModule, resolveDbPort } from './dev-local.mjs';

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

test('explicit database port overrides the path-derived port', () => {
  assert.equal(resolveDbPort('/a/demochal', '55432'), '55432');
  assert.equal(resolveDbPort('/a/demochal', ''), '');
  assert.equal(resolveDbPort('/a/demochal', undefined), String(dbPortFor('/a/demochal')));
});

test('main module detection resolves symlinked entry paths', () => {
  const dir = mkdtempSync(join(realpathSync(tmpdir()), 'dev-local-'));
  const target = join(dir, 'target.mjs');
  const link = join(dir, 'entry.mjs');
  writeFileSync(target, '');
  symlinkSync(target, link);

  assert.equal(isMainModule(link, pathToFileURL(target).href), true);
});
