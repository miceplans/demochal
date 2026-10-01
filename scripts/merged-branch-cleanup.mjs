#!/usr/bin/env node
/**
 * Deletes head branches of merged PRs once they stay inactive for a retention
 * window (default 24h) after the merge. A branch qualifies only when its
 * current ref still points at the PR's merge-time head SHA and the head commit
 * predates the merge, so any push after the merge keeps the branch. The
 * default branch, fork PRs, and already deleted branches are never touched; a
 * refused delete (e.g. protected branch) is recorded and skipped. Set DRY_RUN
 * to list targets without deleting. Requires Node >= 20 (global fetch).
 */
import { pathToFileURL } from 'node:url';

const API_BASE = 'https://api.github.com';

export class GithubApiError extends Error {
  constructor(status, path) {
    super(`GitHub API request failed: HTTP ${status} ${path}`);
    this.name = 'GithubApiError';
    this.status = status;
  }
}

function encodeRef(branch) {
  // Refs are path segments: encode each segment but keep the slashes.
  return branch.split('/').map(encodeURIComponent).join('/');
}

export function createCleaner({
  repo,
  token,
  fetchImpl = fetch,
  now = () => new Date(),
  retentionHours = 24,
  windowDays = 30,
  dryRun = false,
  log = () => {},
}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'merged-branch-cleanup',
  };

  async function request(method, path, { body, allowedErrors = [] } = {}) {
    const res = await fetchImpl(`${API_BASE}${path}`, {
      method,
      headers: body === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) {
      return { ok: true, status: res.status, body: res.status === 204 ? null : await res.json() };
    }
    if (allowedErrors.includes(res.status)) {
      return { ok: false, status: res.status, body: null };
    }
    throw new GithubApiError(res.status, path);
  }

  async function findMergedPrs() {
    const windowDate = new Date(now().getTime() - windowDays * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const query = encodeURIComponent(`repo:${repo} is:pr is:merged merged:>=${windowDate}`);
    const items = [];
    for (let page = 1; ; page += 1) {
      const search = await request('GET', `/search/issues?q=${query}&per_page=100&page=${page}`);
      items.push(...search.body.items);
      if (search.body.items.length < 100) break;
    }
    log(`found ${items.length} merged PR(s) since ${windowDate}`);
    return items;
  }

  async function run() {
    const retentionMs = retentionHours * 3_600_000;
    const meta = await request('GET', `/repos/${repo}`);
    const defaultBranch = meta.body.default_branch;
    const summary = { scanned: 0, deleted: [], wouldDelete: [], skipped: [], failed: [] };

    for (const item of await findMergedPrs()) {
      summary.scanned += 1;
      const mergedAt = new Date(item.pull_request.merged_at);
      if (now().getTime() - mergedAt.getTime() < retentionMs) continue;

      const pr = await request('GET', `/repos/${repo}/pulls/${item.number}`);
      const head = pr.body.head;
      const skip = (reason) => {
        summary.skipped.push({ pr: item.number, branch: head.ref, reason });
        log(`skip ${head.ref} (PR #${item.number}): ${reason}`);
      };

      if (!head.repo || head.repo.full_name !== repo) {
        skip('head repository is a fork or no longer exists');
        continue;
      }
      if (head.ref === defaultBranch) {
        skip(`default branch ${defaultBranch} is never deleted`);
        continue;
      }

      const refPath = `/repos/${repo}/git/ref/heads/${encodeRef(head.ref)}`;
      const ref = await request('GET', refPath, { allowedErrors: [404] });
      if (!ref.ok) {
        skip('branch already deleted');
        continue;
      }
      if (ref.body.object.sha !== head.sha) {
        skip('new commits were pushed after the merge');
        continue;
      }

      const commit = await request('GET', `/repos/${repo}/commits/${ref.body.object.sha}`);
      if (new Date(commit.body.commit.committer.date).getTime() > mergedAt.getTime()) {
        skip('head commit is newer than the merge');
        continue;
      }

      if (dryRun) {
        summary.wouldDelete.push(head.ref);
        log(`[dry-run] would delete ${head.ref} (PR #${item.number})`);
        continue;
      }

      const deleted = await request('DELETE', refPath, { allowedErrors: [409, 422] });
      if (!deleted.ok) {
        summary.failed.push({ pr: item.number, branch: head.ref, status: deleted.status });
        log(`delete refused for ${head.ref} (PR #${item.number}): HTTP ${deleted.status}`);
        continue;
      }
      await request('POST', `/repos/${repo}/issues/${item.number}/comments`, {
        body: {
          body:
            `Merged-branch cleanup: head branch \`${head.ref}\` was deleted after ` +
            `${retentionHours}h of inactivity following the merge ` +
            `(merged at ${mergedAt.toISOString()}).`,
        },
      });
      summary.deleted.push(head.ref);
      log(`deleted ${head.ref} (PR #${item.number})`);
    }
    return summary;
  }

  return { run };
}

function parseEnv(env) {
  const repo = env.GITHUB_REPOSITORY;
  if (!repo || !repo.includes('/')) {
    throw new Error('GITHUB_REPOSITORY must be set to owner/repo');
  }
  if (!env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN is required');
  }
  const positiveInt = (name, fallback) => {
    const value = Number.parseInt(env[name] ?? fallback, 10);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${name} must be a positive integer`);
    }
    return value;
  };
  return {
    repo,
    token: env.GITHUB_TOKEN,
    retentionHours: positiveInt('RETENTION_HOURS', '24'),
    windowDays: positiveInt('SCAN_WINDOW_DAYS', '30'),
    dryRun: (env.DRY_RUN ?? 'false').toLowerCase() === 'true',
  };
}

async function main() {
  const options = parseEnv(process.env);
  const cleaner = createCleaner({ ...options, log: (line) => console.log(line) });
  const summary = await cleaner.run();
  console.log(
    `summary: ${summary.deleted.length} deleted, ${summary.wouldDelete.length} pending (dry-run), ` +
      `${summary.skipped.length} skipped, ${summary.failed.length} failed`,
  );
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
