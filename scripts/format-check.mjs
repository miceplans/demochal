#!/usr/bin/env node
/** Checks Prettier only on files changed by the current work item/PR. */
import { execFileSync, spawnSync } from 'node:child_process';

const baseFlag = process.argv.indexOf('--base');
const base = baseFlag >= 0 ? process.argv[baseFlag + 1] : undefined;
if (!base) throw new Error('usage: format-check.mjs --base <git-ref>');

const changed = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', base], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);
const supported = /\.(?:[cm]?[jt]sx?|json|ya?ml|md|css|scss|html)$/i;
const files = [...new Set([...changed, ...untracked])].filter((file) => supported.test(file));

if (!files.length) {
  console.log('formatting: PASS (no supported changed files)');
  process.exit(0);
}
const result = spawnSync('pnpm', ['exec', 'prettier', '--check', ...files], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
