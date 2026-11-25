#!/usr/bin/env node
/**
 * Deterministic, dependency-free guard against accidentally adding credentials.
 * It scans added lines in the requested git diff, plus the names of files added or
 * changed by any commit since the base (a file committed and later removed still stays
 * in history). It deliberately reports a rule and location, never the matched value.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

// Every rule captures the suspected secret value in group 1: the allowlist is
// tested against the matched value only, never the whole added line — a line
// may legitimately mention `process.env` in a fallback or comment while still
// containing a real hardcoded credential.
const rules = [
  ['private-key', /(-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)/],
  ['github-token', /\b(gh[pousr]_[A-Za-z0-9_]{20,})\b/],
  ['aws-access-key', /\b((?:AKIA|ASIA)[A-Z0-9]{16})\b/],
  [
    'credential-assignment',
    /\b(?:api[_-]?key|secret|token|password|passwd|private[_-]?key)\b\s*[:=]\s*['"]([^'"]{8,})['"]/i,
  ],
  // dotenv/shell style, quoted or not (`GLM_API_KEY=abc...`), which the rule above misses:
  // `\b` doesn't split GLM_API_KEY and it requires quotes. Limited to UPPER_SNAKE names at
  // line start with no spaces around `=`, so code and Terraform (`X = a.b`) aren't flagged.
  [
    'dotenv-credential',
    /^\s*(?:export\s+)?[A-Z0-9_]*(?:API_?KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_?KEY)[A-Z0-9_]*=['"]?([^\s'"#]{8,})/,
  ],
];
const safeValue =
  /(?:example|placeholder|change[-_]?me|your[_-]|<[^>]+>|\$\{|process\.env|import\.meta\.env|test[-_]?key)/i;

// Returns the names of the rules flagged by one added line (empty when clean).
export function scanLine(value) {
  const hits = [];
  for (const [rule, pattern] of rules) {
    const match = pattern.exec(value);
    if (match && !safeValue.test(match[1])) hits.push(rule);
  }
  return hits;
}

// Files that hold real settings or key material regardless of their contents.
// `*.example` templates stay allowed; PEM private keys are covered by the content rule,
// since public CA bundles also use the `.pem` extension.
const sensitiveFiles = [
  /^\.env(?:\..+)?$/i,
  /\.tfvars(?:\.json)?$/i,
  /\.tfstate(?:\..+)?$/i,
  /\.(?:p12|pfx|jks|keystore)$/i,
];

export function isSensitivePath(path) {
  const name = path.slice(path.lastIndexOf('/') + 1);
  if (/\.example$/i.test(name)) return false;
  return sensitiveFiles.some((pattern) => pattern.test(name));
}

// Throws when git fails, so an unreadable history never reads as a clean scan.
function listPaths(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args[0]} failed (exit ${result.status})`);
  return result.stdout.split('\0').map((path) => path.replace(/^\n+/, ''));
}

// Merge commits are compared with every parent (-m) so a file introduced only by a
// conflict resolution is seen too.
export function findSensitivePaths(base) {
  const paths = [
    ...listPaths([
      'diff',
      '--no-ext-diff',
      '--no-renames',
      '--diff-filter=d',
      '--name-only',
      '-z',
      base,
    ]),
    ...listPaths([
      'log',
      '-m',
      '--no-renames',
      '--diff-filter=d',
      '--name-only',
      '--format=',
      '-z',
      `${base}..HEAD`,
    ]),
  ];
  return [...new Set(paths)].filter((path) => path && isSensitivePath(path)).sort();
}

async function main() {
  const baseFlag = process.argv.indexOf('--base');
  const base = baseFlag >= 0 ? process.argv[baseFlag + 1] : undefined;
  if (!base) throw new Error('usage: secret-scan.mjs --base <git-ref>');

  // Comparing against the base ref includes committed and uncommitted worker changes
  // locally, while the Actions checkout has the PR head checked out. Deleted files add
  // no lines, so they are excluded; the remaining diff is streamed line by line.
  const git = spawn('git', ['diff', '--no-ext-diff', '--unified=0', '--diff-filter=d', base], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const gitExit = new Promise((resolve, reject) => {
    git.once('error', reject);
    git.once('close', resolve);
  });

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
      for (const rule of scanLine(value)) findings.push({ file, line, rule });
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

  for (const path of findSensitivePaths(base))
    findings.push({ file: path, line: 0, rule: 'sensitive-file' });

  if (findings.length) {
    console.error(
      'Secret scan failed. Remove the credential and use the project secret/config mechanism instead.',
    );
    for (const finding of findings)
      console.error(`${finding.file}:${finding.line} [${finding.rule}]`);
    process.exit(1);
  }
  console.log('secret-scan: PASS');
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
