'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
type UserState = {
  isLoggedIn: boolean;
  interests: string[];
  roles: string[];
  audience: string[];
  notifications: Record<string, boolean>;
  query: string;
  survey: Record<string, string[]>;
  hasCompletedOnboarding: boolean;
  recruitment: {
    challenge: string;
    introduction: string;
    role: string;
    preferred?: string;
    etc?: string;
    /** 필요 역할 슬롯. 이전 버전 저장값에는 없을 수 있어 선택 필드로 둔다. */
    slots?: { id: number; role: string; count: number }[];
  };
  applicationDraft: { role: string; members: { name: string; role: string }[] } | null;
  login: () => void;
  logout: () => void;
  togglePreference: (key: 'interests' | 'roles' | 'audience', value: string) => void;
  toggleNotification: (key: string) => void;
  setQuery: (value: string) => void;
  setSurvey: (step: string, values: string[]) => void;
  completeOnboarding: () => void;
  setRecruitment: (value: UserState['recruitment']) => void;
  saveApplication: (value: NonNullable<UserState['applicationDraft']>) => void;
};
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      interests: ['IT · 소프트웨어', '데이터 · AI'],
      roles: ['프론트엔드', '백엔드'],
      audience: ['대학생'],
      notifications: {
        applicant: true,
        result: true,
        invite: true,
        deadline: true,
        challenge: true,
        award: true,
      },
      query: '',
      survey: {},
      hasCompletedOnboarding: false,
      recruitment: { challenge: '', introduction: '', role: '프론트엔드', preferred: '', etc: '' },
      applicationDraft: null,
      login: () => set({ isLoggedIn: true }),
      logout: () => set({ isLoggedIn: false }),
      togglePreference: (key, value) =>
        set((s) => ({
          [key]: s[key].includes(value) ? s[key].filter((v) => v !== value) : [...s[key], value],
        })),
      toggleNotification: (key) =>
        set((s) => ({ notifications: { ...s.notifications, [key]: !s.notifications[key] } })),
      setQuery: (query) => set({ query }),
      setSurvey: (step, values) => set((s) => ({ survey: { ...s.survey, [step]: values } })),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      setRecruitment: (recruitment) => set({ recruitment }),
      saveApplication: (applicationDraft) => set({ applicationDraft }),
    }),
    {
      name: 'semo-user-publishing',
      version: 2,
      // v1 → v2: 북마크를 서버(TanStack Query)로 옮기며 로컬 bookmarks만 버린다.
      // migrate가 없으면 버전 불일치 시 저장값 전체(온보딩 완료 등)가 무시된다.
      migrate: (persisted) => {
        const { bookmarks: _bookmarks, ...rest } = (persisted ?? {}) as Record<string, unknown>;
        return rest as unknown as UserState;
      },
      partialize: ({
        isLoggedIn,
        interests,
        roles,
        audience,
        notifications,
        survey,
        hasCompletedOnboarding,
        recruitment,
        applicationDraft,
      }) => ({
        isLoggedIn,
        interests,
        roles,
        audience,
        notifications,
        survey,
        hasCompletedOnboarding,
        recruitment,
        applicationDraft,
      }),
      skipHydration: true,
    },
  ),
);
