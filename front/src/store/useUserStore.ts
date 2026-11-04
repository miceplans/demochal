'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PostingInput } from '@/apps/biz/services/BizPostingFormPage';
type UserState = {
  interests: string[];
  query: string;
  survey: Record<string, string[]>;
  hasCompletedOnboarding: boolean;
  recruitment: {
    challenge: string;
    /** 팀명. 이전 버전 저장값에는 없을 수 있어 선택 필드로 둔다. */
    title?: string;
    introduction: string;
    role: string;
    /** 내 역할을 '직접 입력'으로 적는 중인지 여부. */
    roleCustom?: boolean;
    preferred?: string;
    etc?: string;
    /** 필요 역할 슬롯. 이전 버전 저장값에는 없을 수 있어 선택 필드로 둔다. custom은 '직접 입력' 역할. */
    slots?: { id: number; role: string; count: number; custom?: boolean }[];
  };
  applicationDraft: {
    challengeId?: string;
    answers?: Record<string, string | string[]>;
  } | null;
  /** 공고 작성 폼 드래프트(생성 모드). posterFileId는 업로드 완료된 신규 포스터 복원용. */
  postingDraft: (PostingInput & { posterFileId?: string }) | null;
  logout: () => void;
  setQuery: (value: string) => void;
  setSurvey: (step: string, values: string[]) => void;
  completeOnboarding: () => void;
  setRecruitment: (value: UserState['recruitment']) => void;
  saveApplication: (value: NonNullable<UserState['applicationDraft']>) => void;
  savePosting: (value: UserState['postingDraft']) => void;
};
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      interests: ['IT · 소프트웨어', '데이터 · AI'],
      query: '',
      survey: {},
      hasCompletedOnboarding: false,
      recruitment: {
        challenge: '',
        title: '',
        introduction: '',
        role: '프론트엔드',
        preferred: '',
        etc: '',
      },
      applicationDraft: null,
      logout: () => set({ applicationDraft: null, postingDraft: null }),
      setQuery: (query) => set({ query }),
      setSurvey: (step, values) => set((s) => ({ survey: { ...s.survey, [step]: values } })),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      setRecruitment: (recruitment) => set({ recruitment }),
      saveApplication: (applicationDraft) => set({ applicationDraft }),
      postingDraft: null,
      savePosting: (postingDraft) => set({ postingDraft }),
    }),
    {
      name: 'semo-user-publishing',
      version: 4,
      // v1 → v2: 북마크를 서버(TanStack Query)로 옮기며 로컬 bookmarks만 버린다.
      // v2 → v3: '선호 역할'/'참가 대상' 칩 제거(서버 미지원)로 roles/audience를 버린다.
      // migrate가 없으면 버전 불일치 시 저장값 전체(온보딩 완료 등)가 무시된다.
      // v1/v2 저장값이 모두 이 migrate 하나를 거치므로 폐기 필드를 한 번에 뺀다.
      migrate: (persisted) => {
        const rest = { ...(persisted ?? {}) } as Record<string, unknown>;
        delete rest.bookmarks;
        delete rest.roles;
        delete rest.audience;
        delete rest.isLoggedIn;
        return rest as unknown as UserState;
      },
      partialize: ({
        interests,
        survey,
        hasCompletedOnboarding,
        recruitment,
        applicationDraft,
        postingDraft,
      }) => ({
        interests,
        survey,
        hasCompletedOnboarding,
        recruitment,
        applicationDraft,
        postingDraft,
      }),
      skipHydration: true,
    },
  ),
);

// skipHydration이라도 최초 진입(새로고침/직접 URL)에서 렌더 전에 저장값을 불러오게 한다.
// UserShell/BizShell의 effect 재수화는 이미 수화된 뒤라 무해하다.
if (typeof window !== 'undefined') void useUserStore.persist.rehydrate();
