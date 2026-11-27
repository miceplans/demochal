import { beforeEach, describe, expect, it } from 'vitest';
import { useUserStore } from './useUserStore';

const STORAGE_KEY = 'semo-user-publishing';

describe('useUserStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useUserStore.getState().clearPersonalData();
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

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      state: Record<string, unknown>;
    };
    expect(Object.keys(persisted.state).sort()).toEqual(['ownerId', 'recruitment', 'survey']);
  });

  it('주인 정보 없이 저장된 이전 버전(v4) 데이터는 복원하지 않는다', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 4,
        state: {
          survey: { activity: ['대학생'] },
          hasCompletedOnboarding: true,
          applicationDraft: { challengeId: 'c1', answers: { q1: '연락처 010-0000-0000' } },
        },
      }),
    );

    await useUserStore.persist.rehydrate();

    const state = useUserStore.getState() as unknown as Record<string, unknown>;
    expect(state.survey).toEqual({});
    expect(state.ownerId).toBeNull();
    expect(state.applicationDraft).toBeUndefined();
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('010-0000-0000');
  });
});
