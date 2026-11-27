'use client';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

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

const LEGACY_STORAGE_KEY = 'semo-user-publishing';
// 구 키(semo-user-publishing)의 저장값을 새 키로 1회 이어받는 storage 래퍼.
// skipHydration이라 실제 읽기는 persist.rehydrate() 시점에 일어나므로 마이그레이션도 그 전에 끝난다.
// 옮겨진 구 저장값은 기존과 동일하게 version/migrate(v4 미만 폐기) 대상이 된다.
const storageWithLegacyMigration: StateStorage = {
  getItem: (name) => {
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null) {
      if (window.localStorage.getItem(name) === null) {
        try {
          JSON.parse(legacy);
          window.localStorage.setItem(name, legacy);
        } catch {
          // 손상된 구 저장값은 옮기지 않고 버린다.
        }
      }
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    return window.localStorage.getItem(name);
  },
  setItem: (name, value) => window.localStorage.setItem(name, value),
  removeItem: (name) => {
    window.localStorage.removeItem(name);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  },
};

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
      name: 'semochal-user',
      // SSR에서는 window가 없어 getStorage가 throw하고 storage가 비활성화된다(기존 기본값과 동일).
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') throw new Error('window is not available');
        // Safari "모든 쿠키 차단" 등으로 localStorage 접근 자체가 막히면 여기서 throw해
        // persist가 조용히 비활성화된다(기존 기본 storage의 getStorage throw와 동일한 동작).
        window.localStorage.getItem(LEGACY_STORAGE_KEY);
        return storageWithLegacyMigration;
      }),
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
