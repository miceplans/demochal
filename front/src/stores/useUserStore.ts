'use client';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
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
  logout: () => void;
  setQuery: (value: string) => void;
  setSurvey: (step: string, values: string[]) => void;
  completeOnboarding: () => void;
  setRecruitment: (value: UserState['recruitment']) => void;
  saveApplication: (value: NonNullable<UserState['applicationDraft']>) => void;
  clearApplication: () => void;
};
const LEGACY_STORAGE_KEY = 'semo-user-publishing';
// 구 키(semo-user-publishing)의 저장값을 새 키로 1회 이어받는 storage 래퍼.
// skipHydration이라 실제 읽기는 persist.rehydrate() 시점에 일어나므로 마이그레이션도 그 전에 끝난다.
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
      logout: () => set({ applicationDraft: null }),
      setQuery: (query) => set({ query }),
      setSurvey: (step, values) => set((s) => ({ survey: { ...s.survey, [step]: values } })),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      setRecruitment: (recruitment) => set({ recruitment }),
      saveApplication: (applicationDraft) => set({ applicationDraft }),
      clearApplication: () => set({ applicationDraft: null }),
    }),
    {
      name: 'semochal-user',
      // SSR에서는 window가 없어 getStorage가 throw하고 storage가 비활성화된다(기존 기본값과 동일).
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') throw new Error('window is not available');
        return storageWithLegacyMigration;
      }),
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
      }) => ({
        interests,
        survey,
        hasCompletedOnboarding,
        recruitment,
        applicationDraft,
      }),
      skipHydration: true,
    },
  ),
);
