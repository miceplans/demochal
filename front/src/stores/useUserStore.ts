'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Recruitment = {
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

/**
 * 클라이언트 전용 UI/개인화 상태만 둔다. 서버 데이터(로그인 사용자, 관심사, 온보딩 완료 여부 등)는
 * TanStack Query가 담당하므로 여기에 캐시하지 않는다 — 온보딩 완료는 User.onboardingSurvey가 기준.
 *
 * 개인 데이터(survey·recruitment)는 localStorage에 남으므로 `ownerId`(이 데이터를 만든 로그인 사용자)를
 * 함께 저장하고, 로그아웃·세션 만료·다른 계정 로그인 시 `clearPersonalData()`로 비운다
 * (features/auth/session.ts). 지원서 답변 초안은 개인정보가 들어갈 수 있어 이 스토어(localStorage)가 아니라
 * sessionStorage 초안(lib/form-draft.ts)에 둔다.
 */
type UserState = {
  /** 개인 데이터의 주인(로그인 사용자 id). 비로그인 상태에서 만든 데이터면 null. */
  ownerId: string | null;
  query: string;
  /** 온보딩 설문 진행 중 선택값(제출 전 임시 상태). 제출 후의 기준은 서버 onboardingSurvey다. */
  survey: Record<string, string[]>;
  recruitment: Recruitment;
  setOwner: (ownerId: string | null) => void;
  /** 로컬에 남은 개인 데이터를 기본값으로 되돌린다(로그아웃·계정 전환). */
  clearPersonalData: () => void;
  setQuery: (value: string) => void;
  setSurvey: (step: string, values: string[]) => void;
  setRecruitment: (value: Recruitment) => void;
};

const personalDefaults = (): Pick<UserState, 'ownerId' | 'query' | 'survey' | 'recruitment'> => ({
  ownerId: null,
  query: '',
  survey: {},
  recruitment: {
    challenge: '',
    title: '',
    introduction: '',
    role: '프론트엔드',
    preferred: '',
    etc: '',
  },
});

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      ...personalDefaults(),
      setOwner: (ownerId) => set({ ownerId }),
      clearPersonalData: () => set(personalDefaults()),
      setQuery: (query) => set({ query }),
      setSurvey: (step, values) => set((s) => ({ survey: { ...s.survey, [step]: values } })),
      setRecruitment: (recruitment) => set({ recruitment }),
    }),
    {
      name: 'semo-user-publishing',
      version: 5,
      // v1 → v2: 북마크를 서버(TanStack Query)로 옮기며 로컬 bookmarks만 버린다.
      // v2 → v3: '선호 역할'/'참가 대상' 칩 제거(서버 미지원)로 roles/audience를 버린다.
      // v4 → v5: 주인(ownerId) 없이 저장된 개인 데이터는 누구 것인지 알 수 없어(공용 PC에서
      //   다음 사용자에게 이어질 수 있음) 전부 버린다. hasCompletedOnboarding(서버 기준으로 일원화),
      //   interests(서버 관심사 API로 대체), applicationDraft(sessionStorage로 이동)도 함께 폐기된다.
      // migrate가 없으면 버전 불일치 시 저장값 전체가 무시된다.
      migrate: (persisted, version) => {
        if (version < 5) return personalDefaults() as unknown as UserState;
        return persisted as UserState;
      },
      partialize: ({ ownerId, survey, recruitment }) => ({ ownerId, survey, recruitment }),
      skipHydration: true,
    },
  ),
);
