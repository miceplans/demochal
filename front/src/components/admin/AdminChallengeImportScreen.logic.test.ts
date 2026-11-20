import { describe, expect, it } from 'vitest';
import {
  IMPORT_TEMPLATE,
  normalizeImportItem,
  parseImportInput,
  toDescriptionHtml,
  toKstIso,
} from './AdminChallengeImportScreen.logic';

const now = new Date('2026-11-19T00:00:00+09:00');
const base = {
  title: '제5회 공공데이터 공모전',
  host: '행정안전부',
  category: '대회',
  description: '본문\n\n시상',
  startDate: '2026-11-20',
  endDate: '2026.12.31',
  recruitUrl: 'https://example.com/apply',
  targets: ['대학생'],
  organizerType: '중앙정부/기관',
  prizeAmount: 1000,
  hashtags: ['#공공데이터', '공공데이터'],
};

describe('toKstIso', () => {
  it('fills date-only input to KST start/end of day and keeps explicit offsets', () => {
    expect(toKstIso('2026-12-31', 'end')).toBe('2026-12-31T23:59:59+09:00');
    expect(toKstIso('2026.1.5')).toBe('2026-01-05T00:00:00+09:00');
    expect(toKstIso('2026-12-31 18:00', 'end')).toBe('2026-12-31T18:00:00+09:00');
    expect(toKstIso('2026-12-31T09:00:00.000Z')).toBe('2026-12-31T09:00:00.000Z');
    expect(() => toKstIso('내일')).toThrow('해석할 수 없어요');
  });
});

describe('toDescriptionHtml', () => {
  it('escapes plain text into paragraphs and keeps HTML as is', () => {
    expect(toDescriptionHtml('1<2 & 3\nx\n\ny')).toBe('<p>1&lt;2 &amp; 3<br>x</p><p>y</p>');
    expect(toDescriptionHtml('<p>hi</p>')).toBe('<p>hi</p>');
  });
});

describe('normalizeImportItem', () => {
  it('builds the import request body', () => {
    const { payload, errors } = normalizeImportItem(base, now);
    expect(errors).toEqual([]);
    expect(payload).toMatchObject({
      title: base.title,
      host: '행정안전부',
      price: 0,
      endDate: '2026-12-31T23:59:59+09:00',
      recruitMethod: 'external',
      hashtags: ['공공데이터'],
      description: '<p>본문</p><p>시상</p>',
    });
    expect(payload).not.toHaveProperty('businessId');
    expect(payload).not.toHaveProperty('status');
  });

  it('reports missing required fields and invalid enum values', () => {
    const { errors } = normalizeImportItem(
      { title: 'x', targets: ['외계인'], organizerType: '우주', recruitUrl: 'ftp://x' },
      now,
    );
    const joined = errors.join('\n');
    for (const field of [
      'host',
      'description',
      'endDate',
      'category',
      'targets',
      'organizerType',
      'recruitUrl',
    ]) {
      expect(joined).toContain(field);
    }
  });

  it('does not require recruitUrl for seMOchall recruiting and completes a half event period', () => {
    const { payload, errors } = normalizeImportItem(
      { ...base, recruitMethod: 'seMOchall', recruitUrl: undefined, eventStartDate: '2027-01-10' },
      now,
    );
    expect(errors).toEqual([]);
    expect(payload.recruitUrl).toBeUndefined();
    expect(payload.eventEndDate).toBe('2027-01-10T23:59:59+09:00');
  });

  it('warns about non-standard categories and past deadlines', () => {
    const { warnings } = normalizeImportItem(
      { ...base, category: '봉사', startDate: '2025-01-01', endDate: '2025-02-01' },
      now,
    );
    expect(warnings.some((w) => w.includes('봉사'))).toBe(true);
    expect(warnings.some((w) => w.includes('지났어요'))).toBe(true);
  });
});

describe('parseImportInput', () => {
  it('accepts an object, an array, and { contests }', () => {
    expect(parseImportInput(JSON.stringify(base), now)).toHaveLength(1);
    expect(parseImportInput(JSON.stringify([base, base]), now)).toHaveLength(2);
    expect(parseImportInput(JSON.stringify({ contests: [base] }), now)).toHaveLength(1);
  });

  it('rejects invalid JSON and empty input, and flags non-object items', () => {
    expect(() => parseImportInput('{', now)).toThrow('JSON');
    expect(() => parseImportInput('[]', now)).toThrow('없어요');
    expect(parseImportInput('[1]', now)[0]!.errors).toEqual(['공고 항목은 객체여야 해요.']);
  });

  it('the bundled template validates without errors', () => {
    const rows = parseImportInput(IMPORT_TEMPLATE, now);
    expect(rows.flatMap((row) => row.errors)).toEqual([]);
  });
});
