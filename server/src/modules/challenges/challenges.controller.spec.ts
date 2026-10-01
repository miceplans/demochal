import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { ChallengesController } from './challenges.controller.js';

describe('ChallengesController 공개 조회', () => {
  it.each(['list', 'findOne', 'getStats', 'listSimilar'] as const)(
    '%s는 로그인 없이 조회할 수 있다(draft는 서비스에서 제외)',
    (handler) => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, ChallengesController.prototype[handler])).toBe(
        true,
      );
    },
  );

  it.each(['listRecommended', 'findMine', 'getMineStats', 'create'] as const)(
    '%s는 세션이 필요하다',
    (handler) => {
      expect(
        Reflect.getMetadata(IS_PUBLIC_KEY, ChallengesController.prototype[handler]),
      ).toBeUndefined();
    },
  );
});
