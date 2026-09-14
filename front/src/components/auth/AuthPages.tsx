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
import { adApi } from '@/lib/ad-api';
import copy from '@/data/design-copy.json';
const steps = ['activity', 'interests', 'purpose', 'challenge'];
const EMPTY: string[] = [];
export function LoginPage() {
  const router = useRouter();
  const hasCompletedOnboarding = useUserStore((s) => s.hasCompletedOnboarding);
  const continueAfterLogin = async () => {
    try {
      const user = await adApi.auth.me();
      router.push(user.onboardingSurvey ? '/' : '/onboarding/activity');
    } catch {
      router.push(hasCompletedOnboarding ? '/' : '/onboarding/activity');
    }
  };
  const startGoogleLogin = () => {
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? '/api';
    window.location.assign(`${apiOrigin.replace(/\/$/, '')}/auth/google`);
  };

  return (
    <UserShell compact navigation={false} footer={false} centerHeader>
      <Login>
        <Stack gap={4} style={{ alignItems: 'center' }}>
          <Logo dot />
          <p style={{ fontSize: 11 }}>세상의 모든 챌린지</p>
        </Stack>
        <Stack gap={8}>
          {['Kakao', 'Google', 'Naver'].map((provider, i) => (
            <Social
              key={provider}
              href={hasCompletedOnboarding ? '/' : '/onboarding/activity'}
              provider={provider}
              onClick={(event) => {
                event.preventDefault();
                if (provider === 'Google') {
                  startGoogleLogin();
                  return;
                }
                void continueAfterLogin();
              }}
            >
              <Icon name={i === 0 ? 'imgImage2' : i === 1 ? 'imgImage1' : 'imgImage3'} size={18} />
              <span>{provider}계정으로 계속하기</span>
            </Social>
          ))}
        </Stack>
      </Login>
    </UserShell>
  );
}
export function OnboardingPage({ step }: { step: string }) {
  const router = useRouter();
  const selected = useUserStore((s) => s.survey[step] ?? EMPTY);
  const survey = useUserStore((s) => s.survey);
  const setSurvey = useUserStore((s) => s.setSurvey);
  const hasCompletedOnboarding = useUserStore((s) => s.hasCompletedOnboarding);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const index = steps.indexOf(step);

  useEffect(() => {
    if (hasCompletedOnboarding) router.replace('/');
  }, [hasCompletedOnboarding, router]);

  const titles = [
    '지금 어떤 활동을 하고 계신가요?',
    '어떤 분야에 관심이 있으신가요?',
    '참여하는 목적은 무엇인가요?',
    '어떤 종류의 도전을 찾고 계신가요?',
  ];
  const options = index === 1 ? copy.fields : index === 2 ? copy.purposes : copy.types;
  const toggle = (x: string) =>
    setSurvey(step, selected.includes(x) ? selected.filter((v) => v !== x) : [...selected, x]);
  return (
    <UserShell compact navigation={false} footer={false} header={false}>
      <Survey>
        <Logo dot />
        <ProgressTrack
          role="progressbar"
          aria-label="관심 설문 진행"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={index + 1}
        >
          <ProgressFill style={{ width: `${(index + 1) * 25}%` }} />
        </ProgressTrack>
        <h1 style={{ ...textStyle.h1, marginBottom: 20 }}>{titles[index]}</h1>
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
          <PurposeGrid role="group" aria-label="참여 목적">
            {options.map((x) => {
              const isSelected = selected.includes(x);
              return (
                <PurposeOption
                  key={x}
                  type="button"
                  selected={isSelected}
                  aria-pressed={isSelected}
                  onClick={() => toggle(x)}
                >
                  <PurposeCheck selected={isSelected}>
                    {isSelected && <Icon src="/assets/icons/check.svg" size={10} alt="" />}
                  </PurposeCheck>
                  {x}
                </PurposeOption>
              );
            })}
          </PurposeGrid>
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
            disabled={!selected.length}
            onClick={async () => {
              if (index === 3) {
                try {
                  await adApi.users.saveSurvey({
                    interests: survey.interests ?? [],
                    purposes: survey.purpose ?? [],
                    challengeTypes: survey.challenge ?? [],
                  });
                } catch {
                  // The publishing prototype can be used without an API session;
                  // local completion still prevents the survey from being shown again.
                }
                completeOnboarding();
                router.replace('/');
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
  '& button': {
    borderRadius: 20,
    borderWidth: 0.5,
    padding: '8px 10px',
    fontSize: 12,
  },
  '& button[aria-pressed="true"]': { fontWeight: 600 },
});
const PurposeGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  columnGap: 30,
  rowGap: 16,
  width: '100%',
  [mobile]: { gridTemplateColumns: '1fr', columnGap: 0, rowGap: 12 },
});
const PurposeOption = styled.button<{ selected: boolean }>(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  border: 0,
  background: 'none',
  padding: 0,
  textAlign: 'left' as const,
  cursor: 'pointer',
  ...textStyle.caption,
  color: c.gray700,
}));
const PurposeCheck = styled.span<{ selected: boolean }>(({ selected }) => ({
  display: 'inline-flex',
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
const ProgressTrack = styled.div({
  height: 6,
  background: c.lightBlue,
  borderRadius: 30,
  marginTop: 16,
  marginBottom: 64,
});
const ProgressFill = styled.div({
  height: 6,
  background: c.primary,
  borderRadius: 30,
  transition: 'width 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
  animation: 'semo-survey-progress 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
  '@keyframes semo-survey-progress': {
    from: { width: 0 },
  },
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
    transition: 'none',
  },
});
