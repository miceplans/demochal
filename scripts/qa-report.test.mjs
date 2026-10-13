import test from 'node:test';
import assert from 'node:assert/strict';
import { issueForReport, sanitizeUrl, validateReport } from './qa-report.mjs';

const base = {
  kind: 'bug',
  summary: '저장 버튼이 동작하지 않음',
  url: 'https://staging.example.com/profile',
  scenario: '프로필 저장',
  environment: 'staging / desktop',
  viewport: '390x844',
  area: 'profile editor',
  reproSteps: ['프로필 화면을 연다', '이름을 변경하고 저장한다'],
  expected: '성공 토스트가 표시된다',
  actual: '화면 변화가 없고 새로고침하면 변경이 사라진다',
  acceptanceCriteria: ['성공 토스트가 표시된다', '새로고침 후 변경 내용이 유지된다'],
  risk: 'low',
  confidence: 0.95,
  sensitiveAreas: [],
};

test('valid report is normalized and receives a stable fingerprint', () => {
  const first = validateReport(base);
  const second = validateReport({ ...base });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.automationBlocked, false);
});

test('sensitive evidence is redacted before issue rendering', () => {
  const result = issueForReport({
    ...base,
    consoleErrors: ['Authorization: Bearer abc123', 'password=secret'],
  });
  assert.match(result.body, /\[REDACTED\]/);
  assert.doesNotMatch(result.body, /abc123|secret/);
});

test('low confidence and elevated risk block automation', () => {
  assert.equal(issueForReport({ ...base, confidence: 0.79 }).automationBlocked, true);
  assert.deepEqual(issueForReport({ ...base, risk: 'high' }).labels, ['needs-human']);
});

test('malformed reports are rejected', () => {
  assert.throws(() => validateReport({ ...base, url: 'javascript:alert(1)' }), /valid URL/);
  assert.throws(() => sanitizeUrl('https://user:pass@example.com'), /credentials/);
  assert.throws(
    () => validateReport({ ...base, url: `https://example.com/${'x'.repeat(2048)}` }),
    /at most 2048/,
  );
  assert.throws(() => validateReport({ ...base, consoleErrors: [42] }), /only strings/);
  assert.throws(
    () => validateReport({ ...base, sensitiveAreas: undefined }),
    /sensitiveAreas is required/,
  );
  assert.throws(() => validateReport({ ...base, acceptanceCriteria: [] }), /acceptanceCriteria/);
  assert.throws(() => validateReport({ ...base, reproSteps: [''] }), /empty items/);
  assert.throws(() => validateReport({ ...base, confidence: 2 }), /confidence/);
});

test('sensitive areas force human review and PII is redacted', () => {
  const result = issueForReport({
    ...base,
    sensitiveAreas: ['personal-data'],
    actual: 'user@example.com 전화 010-1234-5678',
  });
  assert.deepEqual(result.labels, ['needs-human']);
  assert.match(result.body, /REDACTED_EMAIL/);
  assert.match(result.body, /REDACTED_PHONE/);
});
