#!/usr/bin/env node
/**
 * Deterministic, dependency-free guard against accidentally adding credentials.
 * It scans only added lines in the requested git diff and deliberately reports
 * a rule and location, never the matched value.
 */
import { execFileSync } from 'node:child_process';

const baseFlag = process.argv.indexOf('--base');
const base = baseFlag >= 0 ? process.argv[baseFlag + 1] : undefined;
if (!base) throw new Error('usage: secret-scan.mjs --base <git-ref>');

// Comparing against the base ref includes committed and uncommitted worker changes
// locally, while the Actions checkout has the PR head checked out.
const diff = execFileSync('git', ['diff', '--no-ext-diff', '--unified=0', base], {
  encoding: 'utf8',
});

const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  [
    'credential-assignment',
    /\b(?:api[_-]?key|secret|token|password|passwd|private[_-]?key)\b\s*[:=]\s*['"][^'"]{8,}['"]/i,
  ],
];
const safeValue =
  /(?:example|placeholder|changeme|your[_-]|<[^>]+>|\$\{|process\.env|import\.meta\.env|test[-_]?key)/i;
const findings = [];
let file = '';
let line = 0;

for (const raw of diff.split('\n')) {
  if (raw.startsWith('+++ b/')) {
    file = raw.slice(6);
    continue;
  }
  const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (hunk) {
    line = Number(hunk[1]);
    continue;
  }
  if (!file || raw.startsWith('+++') || raw.startsWith('---')) continue;
  if (raw.startsWith('+')) {
    const value = raw.slice(1);
    for (const [rule, pattern] of rules) {
      if (pattern.test(value) && !safeValue.test(value)) findings.push({ file, line, rule });
    }
    line += 1;
  } else if (!raw.startsWith('-')) {
    line += 1;
  }
}

if (findings.length) {
  console.error(
    'Secret scan failed. Remove the credential and use the project secret/config mechanism instead.',
  );
  for (const finding of findings)
    console.error(`${finding.file}:${finding.line} [${finding.rule}]`);
  process.exit(1);
}
console.log('secret-scan: PASS');
