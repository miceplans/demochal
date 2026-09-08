'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
type UserState = {
  bookmarks: string[];
  interests: string[];
  roles: string[];
  audience: string[];
  notifications: Record<string, boolean>;
  query: string;
  survey: Record<string, string[]>;
  recruitment: { challenge: string; introduction: string; role: string };
  applicationDraft: { role: string; members: { name: string; role: string }[] } | null;
  toggleBookmark: (id: string) => void;
  togglePreference: (key: 'interests' | 'roles' | 'audience', value: string) => void;
  toggleNotification: (key: string) => void;
  setQuery: (value: string) => void;
  setSurvey: (step: string, values: string[]) => void;
  setRecruitment: (value: UserState['recruitment']) => void;
  saveApplication: (value: NonNullable<UserState['applicationDraft']>) => void;
};
export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      bookmarks: ['contest-1', 'contest-2', 'contest-3', 'contest-4', 'contest-5', 'contest-6'],
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
      recruitment: { challenge: '', introduction: '', role: '프론트엔드' },
      applicationDraft: null,
      toggleBookmark: (id) =>
        set((s) => ({
          bookmarks: s.bookmarks.includes(id)
            ? s.bookmarks.filter((v) => v !== id)
            : [...s.bookmarks, id],
        })),
      togglePreference: (key, value) =>
        set((s) => ({
          [key]: s[key].includes(value) ? s[key].filter((v) => v !== value) : [...s[key], value],
        })),
      toggleNotification: (key) =>
        set((s) => ({ notifications: { ...s.notifications, [key]: !s.notifications[key] } })),
      setQuery: (query) => set({ query }),
      setSurvey: (step, values) => set((s) => ({ survey: { ...s.survey, [step]: values } })),
      setRecruitment: (recruitment) => set({ recruitment }),
      saveApplication: (applicationDraft) => set({ applicationDraft }),
    }),
    {
      name: 'semo-user-publishing',
      partialize: ({
        bookmarks,
        interests,
        roles,
        audience,
        notifications,
        survey,
        recruitment,
        applicationDraft,
      }) => ({
        bookmarks,
        interests,
        roles,
        audience,
        notifications,
        survey,
        recruitment,
        applicationDraft,
      }),
      skipHydration: true,
    },
  ),
);
