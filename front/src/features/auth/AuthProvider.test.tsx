import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@semochal/api-client';
import { AuthProvider, needsOnboarding, useAuth } from './AuthProvider';
import { useLogout } from './session';
import { RequireAuth, useAuthGate, useLoginRedirect } from '@/components/auth/RequireAuth';
import { readFormDraft, writeFormDraft } from '@/lib/form-draft';
import { useUserStore } from '@/stores/useUserStore';

const mocks = vi.hoisted(() => ({
  getMyAuthInfo: vi.fn(),
  logout: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/my/bookmarks',
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
}));
vi.mock('@semochal/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@semochal/api-client')>();
  const { useQuery } = await import('@tanstack/react-query');
  const queryKey = ['/auth/me'];
  return {
    ...actual,
    generated: {
      getGetMyAuthInfoQueryKey: () => queryKey,
      // 실제 생성 훅처럼 같은 키의 useQuery를 쓴다 — 캐시·초기화 동작까지 검증하기 위해서다.
      useGetMyAuthInfo: (options?: { query?: Record<string, unknown> }) =>
        useQuery({ queryKey, queryFn: mocks.getMyAuthInfo, ...options?.query }),
      logout: mocks.logout,
    },
  };
});

const user = (id: string, overrides: Record<string, unknown> = {}) => ({
  status: 200,
  data: { id, name: '홍길동', role: 'user', onboardingSurvey: { interests: [] }, ...overrides },
});

let queryClient: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  localStorage.clear();
  sessionStorage.clear();
  useUserStore.getState().clearPersonalData();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('AuthProvider', () => {
  it('/auth/me 200이면 authenticated와 사용자를 준다', async () => {
    mocks.getMyAuthInfo.mockResolvedValue(user('u1'));
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.user?.id).toBe('u1');
  });

  it('401이면 unauthenticated, 그 밖의 오류는 error로 구분한다', async () => {
    mocks.getMyAuthInfo.mockRejectedValue(new ApiError(401, null));
    const unauth = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(unauth.result.current.status).toBe('unauthenticated'));
    unauth.unmount();

    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mocks.getMyAuthInfo.mockRejectedValue(new TypeError('Failed to fetch'));
    const failed = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(failed.result.current.status).toBe('error'));
  });

  it('여러 화면이 useAuth를 써도 /auth/me는 한 번만 조회한다', async () => {
    mocks.getMyAuthInfo.mockResolvedValue(user('u1'));
    function Consumer() {
      const { user: me } = useAuth();
      return <span>{me?.name ?? '-'}</span>;
    }
    render(
      <>
        <Consumer />
        <Consumer />
        <Consumer />
      </>,
      { wrapper },
    );
    await waitFor(() => expect(screen.getAllByText('홍길동')).toHaveLength(3));
    expect(mocks.getMyAuthInfo).toHaveBeenCalledTimes(1);
  });

  it('다른 계정으로 로그인되면 이전 사용자의 로컬 데이터를 지운다', async () => {
    useUserStore.getState().setOwner('previous-user');
    useUserStore.getState().setSurvey('activity', ['대학생']);
    writeFormDraft('application-new:c1', { q1: '이전 사용자 답변' }, { storage: 'session' });
    mocks.getMyAuthInfo.mockResolvedValue(user('next-user'));

    renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(useUserStore.getState().ownerId).toBe('next-user'));
    expect(useUserStore.getState().survey).toEqual({});
    expect(
      readFormDraft('application-new:c1', (v): v is object => !!v, { storage: 'session' }),
    ).toBeNull();
  });

  it('같은 사용자면 로컬 데이터를 유지한다', async () => {
    useUserStore.getState().setOwner('u1');
    useUserStore.getState().setSurvey('activity', ['대학생']);
    mocks.getMyAuthInfo.mockResolvedValue(user('u1'));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(useUserStore.getState().survey).toEqual({ activity: ['대학생'] });
  });
});

describe('needsOnboarding', () => {
  it('서버 onboardingSurvey가 null인 일반 회원만 설문 대상이다', () => {
    expect(needsOnboarding({ role: 'user', onboardingSurvey: null })).toBe(true);
    expect(needsOnboarding({ role: 'user', onboardingSurvey: { interests: [] } })).toBe(false);
    expect(needsOnboarding({ role: 'business', onboardingSurvey: null })).toBe(false);
    expect(needsOnboarding({ role: 'admin', onboardingSurvey: null })).toBe(false);
    expect(needsOnboarding(undefined)).toBe(false);
  });
});

describe('RequireAuth', () => {
  it('로그인 사용자에게 children을 보여준다', async () => {
    mocks.getMyAuthInfo.mockResolvedValue(user('u1'));
    render(<RequireAuth>보호된 내용</RequireAuth>, { wrapper });
    expect(await screen.findByText('보호된 내용')).toBeTruthy();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('비로그인이면 현재 경로를 next로 붙여 로그인으로 보낸다', async () => {
    mocks.getMyAuthInfo.mockRejectedValue(new ApiError(401, null));
    render(<RequireAuth>보호된 내용</RequireAuth>, { wrapper });
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith('/login?next=%2Fmy%2Fbookmarks'),
    );
    expect(screen.queryByText('보호된 내용')).toBeNull();
  });
});

describe('useLogout', () => {
  it('서버 로그아웃 후 로컬 데이터·서버 캐시를 지우고 비로그인 상태가 된다', async () => {
    mocks.getMyAuthInfo.mockResolvedValue(user('u1'));
    mocks.logout.mockResolvedValue({ status: 204 });
    const afterLogout = vi.fn();
    queryClient.setQueryData(['/applications/me'], { status: 200, data: ['private'] });

    const { result } = renderHook(() => ({ auth: useAuth(), logout: useLogout() }), { wrapper });
    await waitFor(() => expect(result.current.auth.status).toBe('authenticated'));
    useUserStore.getState().setRecruitment({ challenge: 'c1', introduction: '소개', role: '기획' });
    writeFormDraft('posting:new', { title: '공고 초안' });

    mocks.getMyAuthInfo.mockRejectedValue(new ApiError(401, null));
    await act(() => result.current.logout(afterLogout));

    expect(mocks.logout).toHaveBeenCalled();
    expect(afterLogout).toHaveBeenCalled();
    expect(useUserStore.getState().recruitment.introduction).toBe('');
    expect(useUserStore.getState().ownerId).toBeNull();
    expect(readFormDraft('posting:new', (v): v is object => !!v)).toBeNull();
    expect(queryClient.getQueryData(['/applications/me'])).toBeUndefined();
    await waitFor(() => expect(result.current.auth.status).toBe('unauthenticated'));
  });

  it('서버 로그아웃이 실패해도 로컬 데이터는 지운다', async () => {
    mocks.getMyAuthInfo.mockRejectedValue(new ApiError(401, null));
    mocks.logout.mockRejectedValue(new TypeError('Failed to fetch'));
    useUserStore.getState().setSurvey('activity', ['직장인']);

    const { result } = renderHook(() => useLogout(), { wrapper });
    await act(() => result.current());

    expect(useUserStore.getState().survey).toEqual({});
  });
});

describe('useLoginRedirect (공통 로그인 리다이렉트 규칙)', () => {
  it('guard는 replace, action은 push로 현재 경로를 next에 붙인다', () => {
    const { result } = renderHook(() => useLoginRedirect());
    result.current('guard');
    expect(mocks.replace).toHaveBeenCalledWith('/login?next=%2Fmy%2Fbookmarks');
    result.current('action');
    expect(mocks.push).toHaveBeenCalledWith('/login?next=%2Fmy%2Fbookmarks');
  });

  it('콘솔은 자기 로그인 화면으로, next 없이 보낼 수 있다', () => {
    const { result } = renderHook(() =>
      useLoginRedirect({ loginPath: '/admin/login', withNext: false }),
    );
    result.current('guard');
    expect(mocks.replace).toHaveBeenCalledWith('/admin/login');
  });
});

describe('useAuthGate (모든 가드의 공통 접근 판단)', () => {
  it('역할이 맞으면 allowed, 다르면 forbidden', async () => {
    mocks.getMyAuthInfo.mockResolvedValue(user('u1', { role: 'user' }));
    const admin = renderHook(() => useAuthGate('admin'), { wrapper });
    await waitFor(() => expect(admin.result.current.gate).toBe('forbidden'));
    const any = renderHook(() => useAuthGate(), { wrapper });
    await waitFor(() => expect(any.result.current.gate).toBe('allowed'));
  });

  it('비로그인은 역할과 무관하게 unauthenticated', async () => {
    mocks.getMyAuthInfo.mockRejectedValue(new ApiError(401, null));
    const { result } = renderHook(() => useAuthGate('business'), { wrapper });
    await waitFor(() => expect(result.current.gate).toBe('unauthenticated'));
  });
});
