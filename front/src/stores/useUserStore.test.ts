import { beforeEach, describe, expect, it } from 'vitest';
import { useUserStore } from './useUserStore';

describe('useUserStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useUserStore.setState({ applicationDraft: null });
  });

  it('신규 사용자의 관심사 초기값은 빈 배열이다', () => {
    expect(useUserStore.getState().interests).toEqual([]);
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
