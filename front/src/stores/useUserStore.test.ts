import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserStore } from './useUserStore';

describe('useUserStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useUserStore.setState({ applicationDraft: null });
  });

  it('clearApplication은 저장된 지원서 초안을 지운다', () => {
    useUserStore
      .getState()
      .saveApplication({ challengeId: 'challenge-1', answers: { q1: '답변' } });
    expect(useUserStore.getState().applicationDraft).toEqual({
      challengeId: 'challenge-1',
      answers: { q1: '답변' },
    });

    useUserStore.getState().clearApplication();

    expect(useUserStore.getState().applicationDraft).toBeNull();
  });

  it('clearApplication은 초안이 없어도 실패하지 않는다', () => {
    useUserStore.getState().clearApplication();

    expect(useUserStore.getState().applicationDraft).toBeNull();
  });
});

describe('useUserStore persist 키 마이그레이션', () => {
  const NEW_KEY = 'semochal-user';
  const LEGACY_KEY = 'semo-user-publishing';

  const persisted = (state: Record<string, unknown>, version: number) =>
    JSON.stringify({ state, version });

  const initialState = useUserStore.getState();

  beforeEach(() => {
    useUserStore.setState(initialState, true);
    localStorage.clear();
  });

  it('구 키에만 데이터가 있으면 rehydrate 시 새 키로 옮기고 구 키를 제거한다', async () => {
    localStorage.setItem(
      LEGACY_KEY,
      persisted(
        {
          hasCompletedOnboarding: true,
          survey: { step1: ['개발'] },
          applicationDraft: { challengeId: 'c1', answers: { q1: 'a1' } },
        },
        4,
      ),
    );

    await useUserStore.persist.rehydrate();

    const state = useUserStore.getState();
    expect(state.hasCompletedOnboarding).toBe(true);
    expect(state.survey).toEqual({ step1: ['개발'] });
    expect(state.applicationDraft).toEqual({ challengeId: 'c1', answers: { q1: 'a1' } });
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    const stored = JSON.parse(localStorage.getItem(NEW_KEY)!);
    expect(stored.version).toBe(4);
    expect(stored.state.hasCompletedOnboarding).toBe(true);
  });

  it('구 키가 없으면 초기 상태로 정상 시작한다', async () => {
    await useUserStore.persist.rehydrate();

    const state = useUserStore.getState();
    expect(state.hasCompletedOnboarding).toBe(false);
    expect(state.survey).toEqual({});
    expect(state.applicationDraft).toBeNull();
    expect(localStorage.getItem(NEW_KEY)).toBeNull();
  });

  it('구 키에 손상된 JSON이 있으면 크래시 없이 초기 상태로 시작하고 구 키를 제거한다', async () => {
    localStorage.setItem(LEGACY_KEY, '{broken json');

    await useUserStore.persist.rehydrate();

    const state = useUserStore.getState();
    expect(state.hasCompletedOnboarding).toBe(false);
    expect(state.applicationDraft).toBeNull();
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(localStorage.getItem(NEW_KEY)).toBeNull();
  });

  it('구 키의 v1 저장값은 migrate를 거쳐 폐기 필드가 제거된 채 이어진다', async () => {
    localStorage.setItem(
      LEGACY_KEY,
      persisted(
        {
          hasCompletedOnboarding: true,
          bookmarks: ['b1'],
          roles: ['프론트엔드'],
          audience: ['대학생'],
          isLoggedIn: true,
        },
        1,
      ),
    );

    await useUserStore.persist.rehydrate();

    const state = useUserStore.getState();
    expect(state.hasCompletedOnboarding).toBe(true);
    expect('bookmarks' in state).toBe(false);
    expect('roles' in state).toBe(false);
    expect('audience' in state).toBe(false);
    expect('isLoggedIn' in state).toBe(false);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    const stored = JSON.parse(localStorage.getItem(NEW_KEY)!);
    expect(stored.version).toBe(4);
    expect(stored.state.hasCompletedOnboarding).toBe(true);
    expect(stored.state.bookmarks).toBeUndefined();
    expect(stored.state.roles).toBeUndefined();
    expect(stored.state.audience).toBeUndefined();
    expect(stored.state.isLoggedIn).toBeUndefined();
  });

  it('새 키와 구 키가 모두 있으면 새 키 데이터를 우선하고 구 키는 제거한다', async () => {
    localStorage.setItem(NEW_KEY, persisted({ hasCompletedOnboarding: true }, 4));
    localStorage.setItem(
      LEGACY_KEY,
      persisted({ hasCompletedOnboarding: false, query: 'legacy' }, 4),
    );

    await useUserStore.persist.rehydrate();

    const state = useUserStore.getState();
    expect(state.hasCompletedOnboarding).toBe(true);
    expect(state.query).toBe('');
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('clearStorage는 새 키와 구 키를 모두 제거한다', async () => {
    localStorage.setItem(NEW_KEY, persisted({ hasCompletedOnboarding: true }, 4));

    await useUserStore.persist.rehydrate();
    // 구버전 탭 등이 남긴 구 키가 로그아웃 후 되살아나지 않아야 한다.
    localStorage.setItem(LEGACY_KEY, persisted({ hasCompletedOnboarding: true }, 4));
    useUserStore.persist.clearStorage();

    expect(localStorage.getItem(NEW_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('localStorage 접근이 차단되면 persist가 비활성화되고 액션은 정상 동작한다', async () => {
    vi.resetModules();
    // Safari "모든 쿠키 차단"처럼 localStorage 접근 자체가 SecurityError로 막히는 상황.
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access is denied', 'SecurityError');
    });
    try {
      const { useUserStore: blockedStore } = await import('./useUserStore');

      expect(() => blockedStore.getState().setQuery('차단')).not.toThrow();
      expect(blockedStore.getState().query).toBe('차단');
      expect(() => blockedStore.getState().completeOnboarding()).not.toThrow();
    } finally {
      getItemSpy.mockRestore();
      vi.resetModules();
    }
  });
});
