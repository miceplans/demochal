import { describe, expect, it } from 'vitest';
import { dateAfterToday, MOCK_CHALLENGES } from './seed-data.js';

const VALID_TARGETS = new Set([
  '어린이',
  '초등학생',
  '중학생',
  '고등학생',
  '대학생',
  '대학원생',
  '제한없음',
  '지역제한',
  '일반인',
  '기업',
]);

const VALID_ORGANIZER_TYPES = new Set([
  '중앙정부/기관',
  '대기업',
  '외국계기업',
  '학교/재단/협회',
  '학회/비영리단체',
  '진흥원',
  '언론',
  '지방자치단체',
  '중소/벤처기업',
  '기타',
]);

describe('development challenge seed data', () => {
  it('provides at least six complete public challenge records with unique ids', () => {
    expect(MOCK_CHALLENGES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(MOCK_CHALLENGES.map((challenge) => challenge.id)).size).toBe(MOCK_CHALLENGES.length);
    for (const challenge of MOCK_CHALLENGES) {
      expect(challenge.title).not.toHaveLength(0);
      expect(challenge.description).not.toHaveLength(0);
      expect(challenge.category).not.toHaveLength(0);
      expect(challenge.price).toBeGreaterThanOrEqual(0);
      expect(challenge.capacity).toBeGreaterThan(0);
      expect(challenge.endOffsetDays).toBeGreaterThan(challenge.startOffsetDays);
    }
  });

  it('only uses filter metadata values the public API accepts', () => {
    for (const challenge of MOCK_CHALLENGES) {
      expect(challenge.targets.length).toBeGreaterThan(0);
      for (const target of challenge.targets) expect(VALID_TARGETS.has(target)).toBe(true);
      expect(VALID_ORGANIZER_TYPES.has(challenge.organizerType)).toBe(true);
      if (challenge.prizeAmount !== null) expect(challenge.prizeAmount).toBeGreaterThan(0);
    }
  });

  it('keeps recruit method and external link consistent', () => {
    for (const challenge of MOCK_CHALLENGES) {
      if (challenge.recruitMethod === 'external') {
        expect(challenge.recruitUrl).toMatch(/^https:\/\//);
      } else {
        expect(challenge.recruitUrl).toBeUndefined();
      }
    }
  });

  it('keeps challenge dates relative to the day the seed runs', () => {
    const now = new Date('2026-09-29T12:34:56.000Z');
    expect(dateAfterToday(-1, now).toISOString()).toBe('2026-09-28T00:00:00.000Z');
    expect(dateAfterToday(7, now).toISOString()).toBe('2026-10-06T00:00:00.000Z');
  });
});
