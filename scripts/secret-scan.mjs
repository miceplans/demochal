#!/usr/bin/env node
/**
 * Deterministic, dependency-free guard against accidentally adding credentials.
 * It scans only added lines in the requested git diff and deliberately reports
 * a rule and location, never the matched value.
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const baseFlag = process.argv.indexOf('--base');
const base = baseFlag >= 0 ? process.argv[baseFlag + 1] : undefined;
if (!base) throw new Error('usage: secret-scan.mjs --base <git-ref>');

// Comparing against the base ref includes committed and uncommitted worker changes
// locally, while the Actions checkout has the PR head checked out.
// `--diff-filter=d` drops deleted files (they add no lines), and the output is streamed
// line by line instead of buffered, so large diffs can't hit execFileSync's maxBuffer (ENOBUFS).
const git = spawn('git', ['diff', '--no-ext-diff', '--unified=0', '--diff-filter=d', base], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
const gitExit = new Promise((resolve, reject) => {
  git.once('error', reject);
  git.once('close', resolve);
});

const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  [
    'credential-assignment',
    /\b(?:api[_-]?key|secret|token|password|passwd|private[_-]?key)\b\s*[:=]\s*['"][^'"]{8,}['"]/i,
  ],
  // dotenv/shell style, quoted or not (`GLM_API_KEY=abc...`), which the rule above misses:
  // `\b` doesn't split GLM_API_KEY and it requires quotes. Limited to UPPER_SNAKE names at
  // line start with no spaces around `=`, so code and Terraform (`X = a.b`) aren't flagged.
  [
    'dotenv-credential',
    /^\s*(?:export\s+)?[A-Z0-9_]*(?:API_?KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_?KEY)[A-Z0-9_]*=['"]?[^\s'"#]{8,}/,
  ],
];
const safeValue =
  /(?:example|placeholder|change[-_]?me|your[_-]|<[^>]+>|\$\{|process\.env|import\.meta\.env|test[-_]?key)/i;
const findings = [];
let file = '';
let line = 0;

for await (const raw of createInterface({ input: git.stdout, crlfDelay: Infinity })) {
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

// Fail closed: a truncated or failed diff must never read as a clean scan.
const exitCode = await gitExit;
if (exitCode !== 0) {
  console.error(`secret-scan: git diff failed (exit ${exitCode}) against base "${base}"`);
  process.exit(2);
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
