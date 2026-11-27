import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUserStore } from './useUserStore';

const STORAGE_KEY = 'semochal-user';
const LEGACY_KEY = 'semo-user-publishing';

const persisted = (state: Record<string, unknown>, version: number) =>
  JSON.stringify({ state, version });

const recruitment = {
  challenge: 'c1',
  title: '팀명',
  introduction: '소개',
  role: '디자인',
  preferred: '프론트엔드',
  etc: '',
};

const resetStore = () => {
  // persist가 붙은 setState는 저장값을 다시 쓰므로, 상태 초기화 뒤 localStorage를 비워야
  // 매 테스트가 깨끗한 저장소에서 시작한다.
  useUserStore.getState().clearPersonalData();
  localStorage.clear();
};

describe('useUserStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('clearPersonalData는 설문·모집 초안·검색어·주인을 기본값으로 되돌린다', () => {
    const state = useUserStore.getState();
    state.setOwner('user-1');
    state.setSurvey('activity', ['대학생']);
    state.setQuery('해커톤');
    state.setRecruitment({ challenge: 'c1', introduction: '소개', role: '디자인' });

    useUserStore.getState().clearPersonalData();

    const cleared = useUserStore.getState();
    expect(cleared.ownerId).toBeNull();
    expect(cleared.survey).toEqual({});
    expect(cleared.query).toBe('');
    expect(cleared.recruitment.introduction).toBe('');
  });

  it('온보딩 완료·지원서 초안·관심사는 스토어(localStorage)에 두지 않는다', () => {
    useUserStore.getState().setSurvey('activity', ['직장인']);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      state: Record<string, unknown>;
    };
    expect(Object.keys(stored.state).sort()).toEqual(['ownerId', 'recruitment', 'survey']);
  });

  it('주인 정보 없이 저장된 이전 버전(v4) 데이터는 복원하지 않는다', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      persisted(
        {
          survey: { activity: ['대학생'] },
          hasCompletedOnboarding: true,
          applicationDraft: { challengeId: 'c1', answers: { q1: '연락처 010-0000-0000' } },
        },
        4,
      ),
    );

    await useUserStore.persist.rehydrate();

    const state = useUserStore.getState() as unknown as Record<string, unknown>;
    expect(state.survey).toEqual({});
    expect(state.ownerId).toBeNull();
    expect(state.applicationDraft).toBeUndefined();
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('010-0000-0000');
  });
});

describe('useUserStore persist 키 마이그레이션', () => {
  beforeEach(() => {
    resetStore();
  });

  it('구 키에만 v5 데이터가 있으면 rehydrate 시 새 키로 옮기고 구 키를 제거한다', async () => {
    localStorage.setItem(
      LEGACY_KEY,
      persisted({ ownerId: 'user-1', survey: { activity: ['대학생'] }, recruitment }, 5),
    );

    await useUserStore.persist.rehydrate();

    const state = useUserStore.getState();
    expect(state.ownerId).toBe('user-1');
    expect(state.survey).toEqual({ activity: ['대학생'] });
    expect(state.recruitment).toEqual(recruitment);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.version).toBe(5);
    expect(stored.state.ownerId).toBe('user-1');
  });

  it('구 키가 없으면 초기 상태로 정상 시작한다', async () => {
    await useUserStore.persist.rehydrate();

    const state = useUserStore.getState();
    expect(state.ownerId).toBeNull();
    expect(state.survey).toEqual({});
    expect(state.recruitment.introduction).toBe('');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('구 키에 손상된 JSON이 있으면 크래시 없이 초기 상태로 시작하고 구 키를 제거한다', async () => {
    localStorage.setItem(LEGACY_KEY, '{broken json');

    await useUserStore.persist.rehydrate();

    const state = useUserStore.getState();
    expect(state.ownerId).toBeNull();
    expect(state.survey).toEqual({});
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('구 키의 v4 저장값은 v5 폐기 정책(migrate)을 거쳐 기본값으로 초기화된다', async () => {
    localStorage.setItem(
      LEGACY_KEY,
      persisted(
        {
          survey: { activity: ['대학생'] },
          hasCompletedOnboarding: true,
          applicationDraft: { challengeId: 'c1', answers: { q1: '연락처 010-0000-0000' } },
        },
        4,
      ),
    );

    await useUserStore.persist.rehydrate();

    const state = useUserStore.getState() as unknown as Record<string, unknown>;
    expect(state.survey).toEqual({});
    expect(state.ownerId).toBeNull();
    expect(state.applicationDraft).toBeUndefined();
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as {
      version: number;
      state: Record<string, unknown>;
    };
    expect(stored.version).toBe(5);
    expect(stored.state.survey).toEqual({});
    expect(stored.state.applicationDraft).toBeUndefined();
  });

  it('새 키와 구 키가 모두 있으면 새 키 데이터를 우선하고 구 키는 제거한다', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      persisted({ ownerId: 'user-1', survey: { activity: ['직장인'] } }, 5),
    );
    localStorage.setItem(
      LEGACY_KEY,
      persisted({ ownerId: 'user-2', survey: { activity: ['대학생'] }, query: 'legacy' }, 5),
    );

    await useUserStore.persist.rehydrate();

    const state = useUserStore.getState();
    expect(state.ownerId).toBe('user-1');
    expect(state.survey).toEqual({ activity: ['직장인'] });
    expect(state.query).toBe('');
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.state.ownerId).toBe('user-1');
  });

  it('clearStorage는 새 키와 구 키를 모두 제거한다', async () => {
    localStorage.setItem(STORAGE_KEY, persisted({ ownerId: 'user-1' }, 5));

    await useUserStore.persist.rehydrate();
    // 구버전 탭 등이 남긴 구 키가 로그아웃 후 되살아나지 않아야 한다.
    localStorage.setItem(LEGACY_KEY, persisted({ ownerId: 'user-2' }, 5));
    useUserStore.persist.clearStorage();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
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
      expect(() => blockedStore.getState().setSurvey('activity', ['대학생'])).not.toThrow();
      expect(blockedStore.getState().survey).toEqual({ activity: ['대학생'] });
      expect(() => blockedStore.getState().setOwner('user-1')).not.toThrow();
    } finally {
      getItemSpy.mockRestore();
      vi.resetModules();
    }
  });
});
