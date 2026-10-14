#!/usr/bin/env node
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { chromium } from 'playwright';
import { validateReport, sanitizeText, sanitizeUrl } from '../scripts/qa-report.mjs';
import { validateScenario } from './scenario.mjs';
import { judgeWithGlm, validateJudgment } from './glm.mjs';

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function redact(value) {
  return sanitizeText(value, 2000);
}

function sanitizeObservation(observation) {
  return {
    url: observation.url ? sanitizeUrl(observation.url) : '',
    title: redact(observation.title),
    domSummary: redact(observation.domSummary),
    stepResults: (observation.stepResults ?? []).map((step) => ({
      ...step,
      label: redact(step.label),
      error: step.error === undefined ? undefined : redact(step.error),
    })),
    consoleErrors: (observation.consoleErrors ?? []).map(redact),
    networkFailures: (observation.networkFailures ?? []).map(redact),
    screenshots: (observation.screenshots ?? []).map(redact),
    executionError: observation.executionError ? redact(observation.executionError) : null,
  };
}

async function removeNoIssueArtifacts(outputDir, screenshots) {
  const outputRoot = resolve(outputDir);
  const paths = [resolve(outputDir, 'report.json'), resolve(outputDir, 'observation.json')];
  for (const screenshot of screenshots) {
    const path = resolve(screenshot);
    const pathWithinOutput = relative(outputRoot, path);
    if (pathWithinOutput && !pathWithinOutput.startsWith('..') && !isAbsolute(pathWithinOutput)) {
      paths.push(path);
    }
  }
  await Promise.all(
    paths.map((path) =>
      unlink(path).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      }),
    ),
  );
}

export function formatHttpFailure({ method, url, status }) {
  return redact(`${method} ${url} — HTTP ${status}`);
}

async function executeScenario(scenario, outputDir) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: scenario.viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const networkFailures = [];
  const screenshots = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(redact(message.text()));
  });
  page.on('requestfailed', (request) => {
    networkFailures.push(
      redact(
        `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'request failed'}`,
      ),
    );
  });
  page.on('response', (response) => {
    if (response.status() >= 400)
      networkFailures.push(
        formatHttpFailure({
          method: response.request().method(),
          url: response.url(),
          status: response.status(),
        }),
      );
  });
  const stepResults = [];
  let executionError = null;
  try {
    await page.goto(sanitizeUrl(scenario.targetUrl), {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    for (const [index, step] of scenario.steps.entries()) {
      try {
        if (step.action === 'click') await page.locator(step.selector).click({ timeout: 10000 });
        if (step.action === 'fill')
          await page.locator(step.selector).fill(sanitizeText(step.value, 500));
        if (step.action === 'press')
          await page.locator(step.selector).press(step.key, { timeout: 10000 });
        if (step.action === 'wait') await page.waitForTimeout(step.ms);
        if (step.action === 'screenshot') {
          const path = resolve(
            outputDir,
            `${String(index + 1).padStart(2, '0')}-${basename(scenario.name).replace(/[^a-z0-9_-]+/gi, '-') || 'step'}.png`,
          );
          await page.screenshot({ path, fullPage: true });
          screenshots.push(path);
        }
        stepResults.push({ label: step.label, action: step.action, status: 'passed' });
      } catch (error) {
        stepResults.push({
          label: step.label,
          action: step.action,
          status: 'failed',
          error: redact(error.message),
        });
        executionError = error;
        break;
      }
    }
    if (!screenshots.length) {
      const path = resolve(outputDir, 'final.png');
      await page.screenshot({ path, fullPage: true });
      screenshots.push(path);
    }
    const domSummary = redact(
      await page
        .locator('body')
        .innerText({ timeout: 5000 })
        .catch(() => 'DOM text unavailable'),
    );
    return {
      url: sanitizeUrl(page.url()),
      title: redact(await page.title()),
      domSummary,
      stepResults,
      consoleErrors,
      networkFailures,
      screenshots,
      executionError: executionError ? redact(executionError.message) : null,
    };
  } catch (error) {
    return {
      url: sanitizeUrl(scenario.targetUrl),
      title: '',
      domSummary: '',
      stepResults,
      consoleErrors,
      networkFailures,
      screenshots,
      executionError: redact(error.message),
    };
  } finally {
    await browser.close();
  }
}

export async function submitReport(
  report,
  {
    fetchImpl = fetch,
    endpoint = process.env.QA_REPORT_ENDPOINT ??
      (process.env.GITHUB_REPOSITORY
        ? `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/dispatches`
        : null),
    token = process.env.QA_REPORT_TOKEN ?? process.env.GITHUB_TOKEN,
  } = {},
) {
  if (!endpoint || !token)
    throw new Error('QA_REPORT_ENDPOINT and QA_REPORT_TOKEN (or GITHUB_TOKEN) are required');
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ event_type: 'qa-report', client_payload: { report } }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`QA report submission returned HTTP ${response.status}`);
}

export async function runQa({
  scenario,
  outputDir = process.env.QA_OUTPUT_DIR ?? './qa-artifacts',
  dryRun = false,
  judge = judgeWithGlm,
  execute = executeScenario,
  submit = submitReport,
}) {
  await mkdir(outputDir, { recursive: true });
  const rawObservation = await execute(scenario, outputDir);
  const observation = sanitizeObservation(rawObservation);
  if (observation.executionError) {
    await writeFile(resolve(outputDir, 'observation.json'), JSON.stringify(observation, null, 2));
    throw new Error(
      `browser execution failed; report not submitted: ${observation.executionError}`,
    );
  }
  const judgment = validateJudgment(
    await judge({
      observation: {
        scenario: {
          name: redact(scenario.name),
          targetUrl: sanitizeUrl(scenario.targetUrl),
          environment: redact(scenario.environment),
          viewport: scenario.viewport,
          steps: scenario.steps.map((step) => ({ action: step.action, label: redact(step.label) })),
        },
        observation,
      },
    }),
  );
  if (judgment.kind === 'none') {
    await removeNoIssueArtifacts(outputDir, rawObservation.screenshots ?? []);
    await writeFile(resolve(outputDir, 'judgment.json'), JSON.stringify(judgment, null, 2));
    return { status: 'no_issue', judgment };
  }
  await writeFile(resolve(outputDir, 'observation.json'), JSON.stringify(observation, null, 2));
  const report = validateReport({
    ...judgment,
    url: observation.url,
    scenario: scenario.name,
    environment: scenario.environment,
    viewport: `${scenario.viewport.width}x${scenario.viewport.height}`,
    area: judgment.area,
    reproSteps: judgment.reproSteps,
    consoleErrors: observation.consoleErrors,
    networkFailures: observation.networkFailures,
    screenshots: observation.screenshots,
  });
  await writeFile(resolve(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  if (!dryRun) await submit(report);
  return { status: 'ok', report };
}

if (process.argv[1]?.endsWith('/runner.mjs')) {
  const scenarioPath = arg('--scenario') ?? process.env.QA_SCENARIO_FILE;
  if (!scenarioPath) throw new Error('--scenario or QA_SCENARIO_FILE is required');
  const scenario = validateScenario(JSON.parse(await readFile(resolve(scenarioPath), 'utf8')));
  const result = await runQa({ scenario, dryRun: process.argv.includes('--dry-run') });
  console.log(
    JSON.stringify({
      status: result.status,
      ...(result.report ? { fingerprint: result.report.fingerprint } : {}),
      dryRun: process.argv.includes('--dry-run'),
    }),
  );
}
