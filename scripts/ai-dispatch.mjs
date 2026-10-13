#!/usr/bin/env node
/**
 * Delivers GitHub event metadata to a trusted, separately operated AI runner.
 * It never sends repository secrets and never changes code or labels itself.
 */
import { readFile } from 'node:fs/promises';
import { sanitizeText, sanitizeUrl } from './qa-report.mjs';

const mode = process.argv[2];
const allowedModes = new Set([
  'triage',
  'worker',
  'pr-risk',
  'ci-repair',
  'qa',
  'pr-review-comment',
]);
if (!allowedModes.has(mode)) throw new Error(`Unsupported dispatch mode: ${mode}`);

const endpoint = process.env.AI_AUTOMATION_WEBHOOK_URL;
const token = process.env.AI_AUTOMATION_WEBHOOK_TOKEN;
if (!endpoint || !token) {
  console.log(`AI dispatch (${mode}) skipped: webhook secrets are not configured.`);
  process.exit(0);
}

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath) throw new Error('GITHUB_EVENT_PATH is required inside GitHub Actions');
const event = JSON.parse(await readFile(eventPath, 'utf8'));
let pullRequestEvent = event.pull_request ?? (event.issue?.pull_request ? event.issue : undefined);
if (
  pullRequestEvent &&
  (!pullRequestEvent.head || !pullRequestEvent.base) &&
  process.env.GITHUB_TOKEN &&
  process.env.GITHUB_REPOSITORY
) {
  const apiBase = process.env.GITHUB_API_URL ?? 'https://api.github.com';
  const metadataResponse = await fetch(
    `${apiBase}/repos/${process.env.GITHUB_REPOSITORY}/pulls/${pullRequestEvent.number}`,
    {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!metadataResponse.ok)
    throw new Error(`Unable to resolve PR metadata: HTTP ${metadataResponse.status}`);
  const metadata = await metadataResponse.json();
  pullRequestEvent = {
    ...pullRequestEvent,
    title: metadata.title,
    body: metadata.body,
    head: metadata.head?.ref,
    base: metadata.base?.ref,
    baseSha: metadata.base?.sha,
  };
}
if (mode === 'pr-review-comment' && (!pullRequestEvent?.head || !pullRequestEvent?.base))
  throw new Error('Unable to resolve PR head/base refs for review comment');
const reviewComment =
  event.comment && pullRequestEvent
    ? {
        id: event.comment.id,
        author: sanitizeText(event.comment.user?.login, 120),
        body: sanitizeText(event.comment.body),
        path: sanitizeText(event.comment.path, 500),
        line: event.comment.line ?? event.comment.original_line ?? null,
        side: sanitizeText(event.comment.side, 20),
        diffHunk: sanitizeText(event.comment.diff_hunk, 4000),
        createdAt: event.comment.created_at,
      }
    : undefined;
const qaUrl = (() => {
  if (!event.inputs?.target_url) return undefined;
  return sanitizeUrl(event.inputs.target_url);
})();
const payload = {
  mode,
  repository: process.env.GITHUB_REPOSITORY,
  eventName: process.env.GITHUB_EVENT_NAME,
  delivery: process.env.GITHUB_RUN_ID,
  issue: event.issue && {
    number: event.issue.number,
    title: event.issue.title,
    body: event.issue.body,
    labels: event.issue.labels?.map(({ name }) => name),
  },
  pullRequest: pullRequestEvent && {
    number: pullRequestEvent.number,
    title: pullRequestEvent.title,
    body: pullRequestEvent.body,
    head:
      typeof pullRequestEvent.head === 'string'
        ? pullRequestEvent.head
        : pullRequestEvent.head?.ref,
    base:
      typeof pullRequestEvent.base === 'string'
        ? pullRequestEvent.base
        : pullRequestEvent.base?.ref,
  },
  workflowRun: event.workflow_run && {
    id: event.workflow_run.id,
    name: event.workflow_run.name,
    conclusion: event.workflow_run.conclusion,
    htmlUrl: event.workflow_run.html_url,
  },
  qa:
    mode === 'qa' && event.inputs
      ? {
          targetUrl: qaUrl,
          scenario: sanitizeText(event.inputs.scenario),
          environment: sanitizeText(event.inputs.environment),
          reportEvent: 'qa-report',
        }
      : undefined,
  reviewComment:
    mode === 'pr-review-comment' && reviewComment
      ? {
          ...reviewComment,
          sessionKey: `${process.env.GITHUB_REPOSITORY}:pr:${pullRequestEvent.number}`,
          idempotencyKey: `${process.env.GITHUB_REPOSITORY}:pr-comment:${reviewComment.id}`,
        }
      : undefined,
};

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(20_000),
});
if (!response.ok) throw new Error(`AI runner returned HTTP ${response.status}`);
console.log(`AI dispatch (${mode}) accepted.`);
