#!/usr/bin/env node
/**
 * Delivers GitHub event metadata to a trusted, separately operated AI runner.
 * It never sends repository secrets and never changes code or labels itself.
 */
import { readFile } from 'node:fs/promises';

const mode = process.argv[2];
const allowedModes = new Set(['triage', 'worker', 'pr-risk', 'ci-repair']);
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
  pullRequest: event.pull_request && {
    number: event.pull_request.number,
    title: event.pull_request.title,
    body: event.pull_request.body,
    head: event.pull_request.head?.ref,
    base: event.pull_request.base?.ref,
  },
  workflowRun: event.workflow_run && {
    id: event.workflow_run.id,
    name: event.workflow_run.name,
    conclusion: event.workflow_run.conclusion,
    htmlUrl: event.workflow_run.html_url,
  },
};

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(20_000),
});
if (!response.ok) throw new Error(`AI runner returned HTTP ${response.status}`);
console.log(`AI dispatch (${mode}) accepted.`);
