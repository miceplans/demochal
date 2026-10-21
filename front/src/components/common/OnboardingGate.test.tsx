import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generated } from '@semochal/api-client';
import { OnboardingGate } from './OnboardingGate';

const replace = vi.fn();
let pathname = '/';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => pathname,
}));

vi.mock('@semochal/api-client', () => ({
  generated: { useGetMyAuthInfo: vi.fn() },
}));

function mockMe(data: Record<string, unknown> | null, isFetching = false) {
  vi.mocked(generated.useGetMyAuthInfo).mockReturnValue({
    data: data ? { status: 200, data } : undefined,
    isFetching,
  } as never);
}

describe('OnboardingGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = '/';
  });

  afterEach(() => cleanup());

  it('설문을 마치지 않은 일반 회원은 온보딩으로 보낸다', () => {
    mockMe({ role: 'user', onboardingSurvey: null });
    render(<OnboardingGate>내용</OnboardingGate>);
    expect(replace).toHaveBeenCalledWith('/onboarding/activity');
  });

  it('내 정보를 다시 불러오는 중에는 보내지 않는다(설문 직후 되튕김 방지)', () => {
    mockMe({ role: 'user', onboardingSurvey: null }, true);
    render(<OnboardingGate>내용</OnboardingGate>);
    expect(replace).not.toHaveBeenCalled();
  });

  it('설문을 마친 회원은 그대로 둔다', () => {
    mockMe({ role: 'user', onboardingSurvey: { activity: [] } });
    render(<OnboardingGate>내용</OnboardingGate>);
    expect(replace).not.toHaveBeenCalled();
  });

  it('기업·관리자 계정과 비로그인 방문자는 보내지 않는다', () => {
    mockMe({ role: 'business', onboardingSurvey: null });
    render(<OnboardingGate>내용</OnboardingGate>);
    mockMe({ role: 'admin', onboardingSurvey: null });
    render(<OnboardingGate>내용</OnboardingGate>);
    mockMe(null);
    render(<OnboardingGate>내용</OnboardingGate>);
    expect(replace).not.toHaveBeenCalled();
  });

  it('온보딩·로그인 경로에서는 보내지 않는다', () => {
    mockMe({ role: 'user', onboardingSurvey: null });
    pathname = '/onboarding/interests';
    render(<OnboardingGate>내용</OnboardingGate>);
    expect(replace).not.toHaveBeenCalled();
  });
});
