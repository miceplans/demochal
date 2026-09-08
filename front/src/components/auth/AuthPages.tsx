'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { UserShell, Logo } from '@/components/common/UserShell';
import { Button, Icon, Stack, Chip, Wrap } from '@/components/common/Primitives';
import { Dropdown } from '@/components/ui/Dropdown';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { useUserStore } from '@/stores/useUserStore';
import copy from '@/data/design-copy.json';
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
  [mobile]: { width: 'min(358px, calc(100vw - 32px))', height: 48, fontSize: 14, borderRadius: 8 },
}));
const KakaoCrop = styled.span({
  width: 13,
  height: 13,
  overflow: 'hidden',
  position: 'relative',
  mixBlendMode: 'darken',
  '& img': { position: 'absolute', width: 44.66, height: 44.66, left: -1.4, top: -14.95 },
});
export function LoginPage() {
  return (
    <UserShell compact navigation={false} footer={false}>
      <Login>
        <Stack gap={4} style={{ alignItems: 'center' }}>
          <Logo dot />
          <p style={{ fontSize: 11 }}>세상의 모든 챌린지</p>
        </Stack>
        <Stack gap={8}>
          {['Kakao', 'Google', 'Naver'].map((provider, i) => (
            <Social key={provider} href="/onboarding/activity" provider={provider}>
              {i === 0 ? (
                <KakaoCrop>
                  <Icon frame="195-1989" name="imgImage2" size={44.66} />
                </KakaoCrop>
              ) : (
                <Icon
                  frame="195-1989"
                  name={i === 1 ? 'imgImage1' : 'imgImage3'}
                  width={i === 1 ? 11.81 : 17.948}
                  height={i === 1 ? 12.094 : 17.948}
                />
              )}
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
  '& button': { borderRadius: 8, padding: '12px 20px' },
  [mobile]: { '& button': { padding: '10px 14px' } },
});
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
export function OnboardingPage({ step }: { step: string }) {
  const router = useRouter();
  const index = steps.indexOf(step);
  const selected = useUserStore((s) => s.survey[step] ?? []);
  const setSurvey = useUserStore((s) => s.setSurvey);
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
    <UserShell compact navigation={false} footer={false}>
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
            onClick={() => router.push(index === 3 ? '/' : `/onboarding/${steps[index + 1]}`)}
          >
            {index === 3 ? '완료' : '다음'}
          </Button>
        </Next>
      </Survey>
    </UserShell>
  );
}
