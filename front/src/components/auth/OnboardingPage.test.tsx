import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@emotion/react';
import { theme } from '@/styles/theme';
import { OnboardingPage } from './AuthPages';
import { useUserStore } from '@/stores/useUserStore';

const mocks = vi.hoisted(() => {
  class MockApiError extends Error {
    constructor(readonly status: number) {
      super('API error');
    }
  }
  const m = {
    push: vi.fn(),
    replace: vi.fn(),
    invalidateQueries: vi.fn(),
    refetch: vi.fn(),
    celebrate: vi.fn(),
    onSuccess: undefined as (() => void) | undefined,
    authResult: {
      isFetchedAfterMount: true,
      isFetching: false,
      isError: false,
      data: { status: 200, data: { onboardingSurvey: null } },
    },
    MockApiError,
    mutate: vi.fn(() => m.onSuccess?.()),
  };
  return m;
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));
vi.mock('@/components/common/UserShell', () => ({
  UserShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Logo: () => <div />,
}));
vi.mock('@/lib/confetti', () => ({ celebrateBadgeAcquisition: mocks.celebrate }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));
vi.mock('@semochal/api-client', () => ({
  ApiError: mocks.MockApiError,
  generated: {
    useGetMyAuthInfo: () => ({ ...mocks.authResult, refetch: mocks.refetch }),
    useSaveOnboardingSurvey: (options: { mutation?: { onSuccess?: () => void } }) => {
      mocks.onSuccess = options.mutation?.onSuccess;
      return { isPending: false, mutate: mocks.mutate };
    },
    getGetMyAuthInfoQueryKey: () => ['auth', 'me'],
  },
}));

function renderOnboarding(step: string) {
  return render(
    <ThemeProvider theme={theme}>
      <OnboardingPage step={step} />
    </ThemeProvider>,
  );
}

describe('OnboardingPage', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({ survey: {}, hasCompletedOnboarding: false });
  });

  it('toggles an interest chip and enables the next button only when selected', async () => {
    const user = userEvent.setup();
    renderOnboarding('interests');

    const chip = screen.getByRole('button', { name: 'IT/SW' });
    const next = screen.getByRole('button', { name: '다음' });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect((next as HTMLButtonElement).disabled).toBe(true);

    await user.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect((next as HTMLButtonElement).disabled).toBe(false);

    await user.click(chip);
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect((next as HTMLButtonElement).disabled).toBe(true);
  });

  it('toggles a purpose check option and enables the next button only when selected', async () => {
    const user = userEvent.setup();
    renderOnboarding('purpose');

    const option = screen.getByRole('button', { name: '상금이 목적이예요' });
    const next = screen.getByRole('button', { name: '다음' });
    expect(option.getAttribute('aria-pressed')).toBe('false');
    expect((next as HTMLButtonElement).disabled).toBe(true);

    await user.click(option);
    expect(option.getAttribute('aria-pressed')).toBe('true');
    expect((next as HTMLButtonElement).disabled).toBe(false);
  });

  it('selects an activity from the dropdown and moves to the next step', async () => {
    const user = userEvent.setup();
    renderOnboarding('activity');

    const next = screen.getByRole('button', { name: '다음' });
    expect((next as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole('combobox', { name: '현재 활동' }));
    await user.click(screen.getByRole('option', { name: '대학생' }));

    expect((next as HTMLButtonElement).disabled).toBe(false);
    await user.click(next);
    expect(mocks.push).toHaveBeenCalledWith('/onboarding/interests');
  });

  it('saves the collected survey selections on the final step', async () => {
    useUserStore.setState({
      survey: {
        interests: ['IT/SW'],
        purpose: ['상금이 목적이예요'],
        challenge: ['공모전'],
      },
    });
    const user = userEvent.setup();
    renderOnboarding('challenge');

    const finish = screen.getByRole('button', { name: '완료' });
    expect((finish as HTMLButtonElement).disabled).toBe(false);

    await user.click(finish);

    expect(mocks.mutate).toHaveBeenCalledWith({
      data: {
        interests: ['IT/SW'],
        purposes: ['상금이 목적이예요'],
        challengeTypes: ['공모전'],
      },
    });
    expect(mocks.celebrate).toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith('/');
  });

  it.each([
    ['activity', 0, 25, '1'],
    ['interests', 25, 50, '2'],
    ['purpose', 50, 75, '3'],
    ['challenge', 75, 100, '4'],
  ])(
    'renders the %s step progress bar filled to %s%% with a fill animation from %s%%',
    (step, fromWidth, toWidth, valueNow) => {
      renderOnboarding(step);

      const progress = screen.getByRole('progressbar');
      expect(progress.getAttribute('aria-valuenow')).toBe(valueNow);
      const fill = progress.firstElementChild as HTMLElement;
      expect(fill.className).not.toBe('');

      const styleText = Array.from(document.querySelectorAll('style'))
        .map((s) => s.textContent ?? '')
        .join('\n');
      // 마운트 시 이전 스텝 폭(from)에서 현재 스텝 폭(to)으로 채우는 keyframes와
      // 애니메이션 비활성화 선언이 주입된다.
      expect(styleText).toContain('semo-onboarding-bar-fill');
      expect(styleText).toContain(`width:${fromWidth}%`);
      expect(styleText).toContain(`width:${toWidth}%`);
      expect(styleText).toContain('prefers-reduced-motion');
    },
  );

  it('applies a horizontal slide-in animation to the step content like the home carousel', () => {
    renderOnboarding('interests');

    const styleText = Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n');
    expect(styleText).toContain('semo-onboarding-step-in');
    expect(styleText).toContain('translateX');
    expect(styleText).toContain('.5s ease-in-out');
    expect(styleText).toContain('prefers-reduced-motion');
  });
});
