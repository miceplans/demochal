'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import styled from '@emotion/styled';
import { UserShell, Logo } from '@/components/common/UserShell';
import { Button, Icon, Stack, Chip, Wrap } from '@/components/common/Primitives';
import { Dropdown } from '@/components/ui/Dropdown';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { useUserStore } from '@/stores/useUserStore';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, generated } from '@semochal/api-client';
import { celebrateBadgeAcquisition } from '@/lib/confetti';
import copy from '@/data/design-copy.json';
import { LoginForm } from '@/features/auth/components/LoginForm';
const Login = styled.div({
  minHeight: 610,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 40,
  [mobile]: { minHeight: 'calc(100dvh - 72px)', padding: '40px 16px', gap: 64 },
});
const Social = styled(Link)<{ provider: string }>(({ provider }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 16,
  height: 30,
  width: 276,
  borderRadius: 4,
  ...textStyle.label,
  background: provider === 'Kakao' ? '#fee500' : provider === 'Naver' ? '#06be34' : c.white,
  color: provider === 'Naver' ? c.white : c.gray900,
  border: provider === 'Google' ? `1px solid ${c.gray200}` : 0,
  [mobile]: {
    width: 'min(358px, calc(100vw - 32px))',
    height: 48,
    fontSize: textStyle.mCardTitle.fontSize,
    borderRadius: 8,
  },
}));
const SOCIAL_LOGIN_PATHS: Record<string, string> = {
  Kakao: '/auth/social/kakao',
  Google: '/auth/google',
  Naver: '/auth/social/naver',
};
const LoginDivider = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: 276,
  ...textStyle.label,
  color: c.gray500,
  '&::before, &::after': { content: '""', flex: 1, height: 1, background: c.gray200 },
  [mobile]: { width: 'min(358px, calc(100vw - 32px))' },
});
const EmailLogin = styled.div({
  width: 276,
  [mobile]: { width: 'min(358px, calc(100vw - 32px))' },
});
export function LoginPage({ next = null }: { next?: string | null }) {
  const hasCompletedOnboarding = useUserStore((s) => s.hasCompletedOnboarding);
  const startSocialLogin = (provider: string) => {
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? '/api';
    const path = SOCIAL_LOGIN_PATHS[provider];
    if (!path) return;
    const query = next ? `?next=${encodeURIComponent(next)}` : '';
    window.location.assign(`${apiOrigin.replace(/\/$/, '')}${path}${query}`);
  };

  return (
    <UserShell compact navigation={false} footer={false} hideMobileHeader>
      <Login>
        <Stack gap={4} style={{ alignItems: 'center' }}>
          <Logo dot />
          <p style={{ fontSize: 11 }}>세상의 모든 챌린지</p>
        </Stack>
        <Stack gap={16} style={{ alignItems: 'center' }}>
          <EmailLogin>
            <LoginForm next={next} />
          </EmailLogin>
          <LoginDivider>또는</LoginDivider>
        </Stack>
        <Stack gap={8}>
          {['Kakao', 'Google', 'Naver'].map((provider, i) => (
            <Social
              key={provider}
              href={hasCompletedOnboarding ? '/' : '/onboarding/activity'}
              provider={provider}
              onClick={(event) => {
                event.preventDefault();
                startSocialLogin(provider);
              }}
            >
              <Icon
                name={i === 0 ? 'imgImage2' : i === 1 ? 'imgImage1' : 'imgImage3'}
                width={i === 0 ? 13 : i === 1 ? 12 : 18}
                height={i === 0 ? 13 : i === 1 ? 13 : 18}
              />
              <span>{provider}계정으로 계속하기</span>
            </Social>
          ))}
        </Stack>
      </Login>
    </UserShell>
  );
}
const Survey = styled.div({
  width: 600,
  maxWidth: 'calc(100% - 32px)',
  margin: '0 auto',
  padding: '80px 0',
  minHeight: 676,
  [mobile]: { padding: '44px 0 110px', minHeight: 'calc(100dvh - 64px)' },
});
const Choices = styled(Wrap)({
  gap: 8,
  '& button': { borderRadius: 999, padding: '8px 14px', fontSize: 12 },
  '& button[aria-pressed="true"]': { fontWeight: 600 },
  [mobile]: { '& button': { padding: '8px 14px' } },
});
const CheckGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  columnGap: 30,
  rowGap: 16,
  width: '100%',
  [mobile]: { gridTemplateColumns: '1fr', rowGap: 12 },
});
const CheckOption = styled.button({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  border: 0,
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  textAlign: 'left',
  ...textStyle.mBodyDetail,
  color: c.gray700,
});
const CheckBox = styled.span<{ selected?: boolean }>(({ selected }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  height: 16,
  flexShrink: 0,
  borderRadius: 3,
  border: selected ? 0 : `0.5px solid ${c.gray100}`,
  background: selected ? c.primary : c.white,
}));
const Next = styled.div({
  marginTop: 40,
  display: 'flex',
  justifyContent: 'flex-end',
  [mobile]: {
    position: 'fixed',
    left: 16,
    right: 16,
    bottom: 16,
    zIndex: 25,
    '& button': { width: '100%', height: 52, borderRadius: 14 },
  },
});
const steps = ['activity', 'interests', 'purpose', 'challenge'];
const EMPTY_SURVEY_SELECTION: readonly string[] = [];
export function OnboardingPage({ step }: { step: string }) {
  const router = useRouter();
  const index = steps.indexOf(step);
  const selected = useUserStore((s) => s.survey[step] ?? EMPTY_SURVEY_SELECTION);
  const survey = useUserStore((s) => s.survey);
  const setSurvey = useUserStore((s) => s.setSurvey);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const queryClient = useQueryClient();
  // 설문은 첫 가입/로그인 사용자만 진행한다. 로컬 플래그는 기기·계정별로 어긋날 수 있어
  // 서버의 onboardingSurvey(null = 미완료)를 기준으로 판단한다. 다른 탭에서 계정이 바뀌었을 수
  // 있으므로 캐시된 /auth/me를 믿지 않고 진입할 때마다 새로 조회한 결과로만 판단한다.
  const auth = generated.useGetMyAuthInfo({
    query: { retry: false, staleTime: 0, refetchOnMount: 'always' },
  });
  const authChecked = auth.isFetchedAfterMount && !auth.isFetching;
  const unauthenticated =
    auth.error instanceof ApiError && (auth.error.status === 401 || auth.error.status === 403);
  const alreadySurveyed =
    authChecked && auth.data?.status === 200 && Boolean(auth.data.data.onboardingSurvey);
  // 실패하면 전역 MutationCache가 에러 토스트를 띄우고, 로컬 완료 처리하지 않아 다시 시도할 수 있다.
  const saveSurvey = generated.useSaveOnboardingSurvey({
    mutation: {
      meta: { handledErrorStatuses: [409] },
      onSuccess: () => {
        completeOnboarding();
        void queryClient.invalidateQueries({ queryKey: generated.getGetMyAuthInfoQueryKey() });
        celebrateBadgeAcquisition();
        router.replace('/');
      },
      onError: (error) => {
        // 409: 다른 탭/기기에서 이미 설문을 완료했다.
        if (error instanceof ApiError && error.status === 409) {
          completeOnboarding();
          router.replace('/');
        }
      },
    },
  });

  useEffect(() => {
    if (!authChecked) return;
    if (unauthenticated) router.replace('/login');
    else if (alreadySurveyed) {
      completeOnboarding();
      router.replace('/');
    }
  }, [authChecked, unauthenticated, alreadySurveyed, completeOnboarding, router]);
  const titles = [
    '지금 어떤 활동을 하고 계신가요?',
    '어떤 분야에 관심이 있으신가요?',
    '참여하는 목적은 무엇인가요?',
    '어떤 종류의 도전을 찾고 계신가요?',
  ];
  const options = index === 1 ? copy.fields : index === 2 ? copy.purposes : copy.types;
  const toggle = (x: string) =>
    setSurvey(step, selected.includes(x) ? selected.filter((v) => v !== x) : [...selected, x]);
  if (!authChecked || unauthenticated || alreadySurveyed) return null;
  if (auth.isError) {
    // 네트워크/서버 오류는 로그인 만료가 아니므로 설문 화면에 머물며 다시 확인할 수 있게 한다.
    // (오류 토스트는 전역 QueryCache가 띄운다.)
    return (
      <UserShell compact navigation={false} footer={false} hideMobileHeader>
        <Survey>
          <Logo dot />
          <Stack gap={16} style={{ marginTop: 64, alignItems: 'flex-start' }}>
            <p style={{ ...textStyle.body, color: c.gray700 }}>
              로그인 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요.
            </p>
            <Button onClick={() => void auth.refetch()}>다시 시도</Button>
          </Stack>
        </Survey>
      </UserShell>
    );
  }
  return (
    <UserShell compact navigation={false} footer={false} hideMobileHeader>
      <Survey>
        <Logo dot />
        <div
          role="progressbar"
          aria-label="관심 설문 진행"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={index + 1}
          style={{
            height: 6,
            background: c.lightBlue,
            borderRadius: 30,
            marginTop: 16,
            marginBottom: 64,
          }}
        >
          <div
            style={{
              height: 6,
              width: `${(index + 1) * 25}%`,
              background: c.primary,
              borderRadius: 30,
            }}
          />
        </div>
        <h1 style={{ ...textStyle.h2, marginBottom: 20 }}>{titles[index]}</h1>
        {index === 0 ? (
          <Dropdown
            aria-label="현재 활동"
            placeholder="활동을 선택하세요"
            value={selected[0] ?? ''}
            onChange={(x) => setSurvey(step, [x])}
            options={[
              '대학생',
              '대학원생',
              '직장인',
              '취업준비생',
              '프리랜서',
              '일반인',
              '청소년',
            ].map((x) => ({ value: x, label: x }))}
          />
        ) : index === 2 ? (
          <CheckGrid>
            {options.map((x) => (
              <CheckOption
                key={x}
                type="button"
                aria-pressed={selected.includes(x)}
                onClick={() => toggle(x)}
              >
                <CheckBox selected={selected.includes(x)}>
                  {selected.includes(x) && (
                    <Icon src="/assets/icons/check.svg" width={11} height={11} alt="" />
                  )}
                </CheckBox>
                {x}
              </CheckOption>
            ))}
          </CheckGrid>
        ) : (
          <Choices>
            {options.map((x) => (
              <Chip
                key={x}
                selected={selected.includes(x)}
                aria-pressed={selected.includes(x)}
                onClick={() => toggle(x)}
              >
                {x}
              </Chip>
            ))}
          </Choices>
        )}
        <Next>
          <Button
            disabled={!selected.length || saveSurvey.isPending}
            onClick={() => {
              if (index === 3) {
                saveSurvey.mutate({
                  data: {
                    interests: survey.interests ?? [],
                    purposes: survey.purpose ?? [],
                    challengeTypes: survey.challenge ?? [],
                  },
                });
                return;
              }
              router.push(`/onboarding/${steps[index + 1]}`);
            }}
          >
            {index === 3 ? '완료' : '다음'}
          </Button>
        </Next>
      </Survey>
    </UserShell>
  );
}
