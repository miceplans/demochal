#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const MAX = {
  summary: 120,
  scenario: 120,
  environment: 80,
  text: 4000,
  listItem: 1000,
  list: 12,
};

const SENSITIVE =
  /((?:authorization|bearer|cookie|set-cookie|x-api-key|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|password|secret)\s*[:=]\s*)[^\s,;]+/gi;
const EMAIL = /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g;
const PHONE = /(?<!\d)(?:\+?82[- .]?)?01[016789][-. ]?\d{3,4}[-. ]?\d{4}(?!\d)/g;
const SENSITIVE_AREAS = [
  'auth',
  'authorization',
  'payment',
  'personal-data',
  'data-deletion',
  'security',
  'policy',
];

export const AUTOMATION_BLOCKERS = Object.freeze({
  lowConfidence: 'confidence below 0.8',
  elevatedRisk: 'risk is high or critical',
});

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function sanitizeText(value, limit = MAX.text) {
  return String(value ?? '')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(SENSITIVE, '$1[REDACTED]')
    .replace(EMAIL, '[REDACTED_EMAIL]')
    .replace(PHONE, '[REDACTED_PHONE]')
    .replace(/https?:\/\/[^\s]+/gi, (url) =>
      url.replace(/([?&](?:token|key|secret|password|code|paymentKey)=)[^&\s]*/gi, '$1REDACTED'),
    )
    .trim()
    .slice(0, limit);
}

export function sanitizeUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048)
    throw new Error('url must be a non-empty string of at most 2048 characters');
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('url must use http or https');
  if (url.username || url.password) throw new Error('url must not contain credentials');
  url.search = '';
  url.hash = '';
  return url.toString();
}

const clean = sanitizeText;

function cleanOptionalList(value, name, limit = MAX.listItem) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX.list)
    throw new Error(`${name} must be an array of at most ${MAX.list} items`);
  if (value.some((item) => typeof item !== 'string'))
    throw new Error(`${name} must contain only strings`);
  return value.map((item) => clean(item, limit));
}

function cleanList(value, name) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX.list) {
    throw new Error(`${name} must contain 1-${MAX.list} items`);
  }
  if (value.some((item) => typeof item !== 'string'))
    throw new Error(`${name} must contain only strings`);
  const cleaned = value.map((item) => clean(item, MAX.listItem));
  if (cleaned.some((item) => !item)) throw new Error(`${name} must not contain empty items`);
  return cleaned;
}

function requiredString(report, name, limit = MAX.text) {
  if (typeof report[name] !== 'string' || !report[name].trim()) {
    throw new Error(`${name} is required`);
  }
  const value = clean(report[name], limit);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function validateReport(input) {
  if (!isObject(input)) throw new Error('report must be an object');
  const kind = input.kind === 'ux' ? 'ux' : input.kind === 'bug' ? 'bug' : null;
  if (!kind) throw new Error('kind must be bug or ux');
  const risk = ['low', 'medium', 'high', 'critical'].includes(input.risk) ? input.risk : null;
  if (!risk) throw new Error('risk must be low, medium, high, or critical');
  if (typeof input.confidence !== 'number' || input.confidence < 0 || input.confidence > 1) {
    throw new Error('confidence must be a number between 0 and 1');
  }
  let url;
  try {
    url = new URL(sanitizeUrl(input.url));
  } catch {
    throw new Error('url must be a valid URL without credentials and at most 2048 characters');
  }
  if (!Array.isArray(input.sensitiveAreas)) throw new Error('sensitiveAreas is required');
  const sensitiveAreas = cleanOptionalList(input.sensitiveAreas, 'sensitiveAreas');
  if (sensitiveAreas.some((area) => !SENSITIVE_AREAS.includes(area)))
    throw new Error('sensitiveAreas contains an unsupported value');

  const report = {
    kind,
    summary: requiredString(input, 'summary', MAX.summary),
    url: url.toString(),
    scenario: requiredString(input, 'scenario', MAX.scenario),
    environment: requiredString(input, 'environment', MAX.environment),
    viewport: requiredString(input, 'viewport', MAX.environment),
    area: requiredString(input, 'area', MAX.environment),
    reproSteps: cleanList(input.reproSteps, 'reproSteps'),
    expected: requiredString(input, 'expected'),
    actual: requiredString(input, 'actual'),
    acceptanceCriteria: cleanList(input.acceptanceCriteria, 'acceptanceCriteria'),
    risk,
    confidence: Number(input.confidence.toFixed(3)),
    consoleErrors: cleanOptionalList(input.consoleErrors, 'consoleErrors'),
    networkFailures: cleanOptionalList(input.networkFailures, 'networkFailures'),
    screenshots: cleanOptionalList(input.screenshots, 'screenshots', 2048),
    sensitiveAreas,
  };

  const fingerprintSource = [report.kind, report.url, report.scenario, report.actual]
    .join('\n')
    .toLowerCase();
  report.fingerprint = createHash('sha256').update(fingerprintSource).digest('hex').slice(0, 24);
  report.automationBlocked =
    report.confidence < 0.8 ||
    ['high', 'critical'].includes(report.risk) ||
    sensitiveAreas.length > 0;
  report.blocker =
    report.confidence < 0.8
      ? AUTOMATION_BLOCKERS.lowConfidence
      : ['high', 'critical'].includes(report.risk)
        ? AUTOMATION_BLOCKERS.elevatedRisk
        : sensitiveAreas.length > 0
          ? `sensitive area: ${sensitiveAreas.join(', ')}`
          : null;
  return report;
}

export function issueForReport(report) {
  const normalized = validateReport(report);
  const prefix = normalized.kind === 'bug' ? 'fix' : 'feat';
  const labels = normalized.automationBlocked ? ['needs-human'] : [];
  const body = [
    `<!-- qa-fingerprint:${normalized.fingerprint} -->`,
    '## 한줄요약',
    normalized.summary,
    '',
    '## QA 관찰 정보',
    `- URL: ${normalized.url}`,
    `- 시나리오: ${normalized.scenario}`,
    `- 환경: ${normalized.environment}`,
    `- viewport: ${normalized.viewport}`,
    `- 관련 영역: ${normalized.area}`,
    `- 신뢰도: ${normalized.confidence}`,
    `- 위험도: ${normalized.risk}`,
    '',
    '## 재현 절차',
    ...normalized.reproSteps.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## 기대 동작',
    normalized.expected,
    '',
    '## 실제 동작',
    normalized.actual,
    '',
    '## 증거',
    ...(normalized.screenshots.length
      ? normalized.screenshots.map((item) => `- screenshot: ${item}`)
      : ['- screenshot: 없음']),
    ...(normalized.consoleErrors.length
      ? normalized.consoleErrors.map((item) => `- console: ${item}`)
      : []),
    ...(normalized.networkFailures.length
      ? normalized.networkFailures.map((item) => `- network: ${item}`)
      : []),
    '',
    '## 인수 조건',
    ...normalized.acceptanceCriteria.map((criterion) => `- [ ] ${criterion}`),
    '',
    '## 자동화 판정',
    normalized.automationBlocked
      ? `- 상태: needs-human\n- 사유: ${normalized.blocker}`
      : '- 상태: 기존 ai-triage에 위임',
    '',
    '## 범위 및 위험',
    '- QA Agent는 이 Issue 생성 이후 코드를 직접 수정하지 않는다.',
    '- 인증/인가, 결제, 개인정보, 데이터 삭제, 보안, 정책 변경은 사람 판단이 필요하다.',
  ].join('\n');
  return {
    title: `${prefix}: ${normalized.summary}`,
    body,
    labels,
    fingerprint: normalized.fingerprint,
    automationBlocked: normalized.automationBlocked,
  };
}

export function reportEvidenceComment(report) {
  const normalized = validateReport(report);
  return [
    'QA 재검사에서 동일 fingerprint 문제가 다시 확인되었습니다.',
    '',
    `- URL: ${normalized.url}`,
    `- 시나리오: ${normalized.scenario}`,
    `- viewport: ${normalized.viewport}`,
    `- 관련 영역: ${normalized.area}`,
    `- 신뢰도: ${normalized.confidence}`,
    ...(normalized.screenshots.length
      ? normalized.screenshots.map((item) => `- screenshot: ${item}`)
      : []),
    ...(normalized.consoleErrors.length
      ? normalized.consoleErrors.map((item) => `- console: ${item}`)
      : []),
    ...(normalized.networkFailures.length
      ? normalized.networkFailures.map((item) => `- network: ${item}`)
      : []),
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [command, path] = process.argv.slice(2);
  if (!command || !path || !['validate', 'render'].includes(command)) {
    console.error('usage: qa-report.mjs <validate|render> <json-file>');
    process.exit(2);
  }
  try {
    const report = validateReport(JSON.parse(await readFile(path, 'utf8')));
    console.log(JSON.stringify(command === 'render' ? issueForReport(report) : report));
  } catch (error) {
    console.error(`QA report rejected: ${error.message}`);
    process.exit(1);
  }
}
