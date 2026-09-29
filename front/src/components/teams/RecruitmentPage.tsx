'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { UserShell } from '@/components/common/UserShell';
import {
  Button,
  Input,
  Stack,
  Row,
  Icon,
  IconButton,
  DesktopOnly,
  Title,
} from '@/components/common/Primitives';
import { Dropdown } from '@/components/ui/Dropdown';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { roles } from '@/data/user-design';
import { useUserStore } from '@/stores/useUserStore';
import { useToast } from '@/components/common/Toast';

export function StepLabel({
  number,
  completed,
  children,
}: {
  number: number;
  completed: boolean;
  children: React.ReactNode;
}) {
  return (
    <Row gap={8} style={textStyle.bodyStrong}>
      <span
        style={{
          width: 24,
          height: 24,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          background: completed ? c.primary : c.white,
          border: `1px solid ${c.primary}`,
          color: completed ? c.white : c.primary,
          fontSize: 12,
        }}
      >
        {number}
      </span>
      {children}
    </Row>
  );
}

export function RecruitmentPage() {
  // useSearchParams는 Suspense 경계가 필요해(정적 프리렌더) 폼을 안쪽 컴포넌트로 감싼다.
  return (
    <Suspense fallback={null}>
      <RecruitmentForm />
    </Suspense>
  );
}

function RecruitmentForm() {
  const draft = useUserStore((s) => s.recruitment);
  const setDraft = useUserStore((s) => s.setRecruitment);
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  // 역할 슬롯도 draft에 함께 저장해 페이지를 나갔다 와도 유지한다.
  const slots = draft.slots ?? [];
  const setSlots = (next: typeof slots) => setDraft({ ...draft, slots: next });
  const challengesQuery = generated.useListChallenges({ limit: 50 });
  const challengeOptions = challengesQuery.data?.data.items ?? [];
  // draft.challenge에는 챌린지 id를 저장한다(레이블은 Dropdown이 옵션에서 찍는다).
  const challengeSelectOptions = challengeOptions
    .filter((x) => Boolean(x.id))
    .map((x) => ({ value: x.id ?? '', label: x.title ?? '제목 없음' }));
  // 챌린지 상세 → "이 챌린지 팀 구하기" 진입 시 ?challengeId=<uuid>로 미리 선택해준다.
  useEffect(() => {
    const preset = searchParams.get('challengeId');
    if (!preset) return;
    const current = useUserStore.getState().recruitment;
    if (current.challenge !== preset) setDraft({ ...current, challenge: preset });
  }, [searchParams, setDraft]);
  const createTeam = generated.useCreateTeam({
    mutation: {
      onSuccess: (result) => {
        setDraft({
          challenge: '',
          introduction: '',
          role: draft.role,
          preferred: '',
          etc: '',
          slots: [],
        });
        toast.success('모집글을 게시했어요');
        router.push(`/teams/${result.data.id}`);
      },
    },
  });
  return (
    <UserShell title="모집글 작성" back="/teams" footer={false}>
      <FormContainer
        onSubmit={(e) => {
          e.preventDefault();
          const challengeId = draft.challenge;
          if (!challengeOptions.some((x) => x.id === challengeId)) {
            toast.error('챌린지를 선택해주세요', '목록에서 챌린지를 골라주세요');
            return;
          }
          createTeam.mutate({
            data: {
              challengeId,
              introduction: draft.introduction.trim() || undefined,
              openRoles: slots.map(({ role, count }) => ({ role, count })),
              myRole: draft.role,
              preferred: draft.preferred?.trim() || undefined,
              etc: draft.etc?.trim() || undefined,
            },
          });
        }}
      >
        <DesktopOnly>
          <Title>모집글 작성</Title>
        </DesktopOnly>
        <Stack gap={10}>
          <StepLabel number={1} completed={!!draft.challenge}>
            챌린지 선택
          </StepLabel>
          <Dropdown
            aria-label="챌린지 선택"
            placeholder="챌린지를 선택하세요"
            value={draft.challenge}
            onChange={(value) => setDraft({ ...draft, challenge: value })}
            options={challengeSelectOptions}
            disabled={challengesQuery.isPending}
          />
        </Stack>
        <Stack gap={10}>
          <StepLabel number={2} completed={!!draft.introduction}>
            팀 소개
          </StepLabel>
          <Input
            aria-label="팀 소개"
            placeholder="팀을 소개해주세요"
            required
            maxLength={300}
            value={draft.introduction}
            onChange={(e) => setDraft({ ...draft, introduction: e.target.value })}
            style={{ color: draft.introduction ? c.gray900 : c.gray500 }}
          />
        </Stack>
        <Stack gap={10}>
          <StepLabel number={3} completed={slots.length > 0}>
            필요 역할 슬롯 추가
          </StepLabel>
          {slots.map((slot, i) => (
            <Row key={slot.id}>
              <Dropdown
                aria-label={`모집 역할 ${i + 1}`}
                size="S"
                value={slot.role}
                style={{ flex: 1 }}
                onChange={(x) =>
                  setSlots(slots.map((s) => (s.id === slot.id ? { ...s, role: x } : s)))
                }
                options={roles.map((x) => ({ value: x, label: x }))}
              />
              <Input
                type="number"
                aria-label={`모집 인원 ${i + 1}`}
                min={1}
                max={10}
                value={slot.count}
                style={{ width: 100, textAlign: 'center' }}
                onChange={(e) =>
                  setSlots(
                    slots.map((s) =>
                      s.id === slot.id ? { ...s, count: Number(e.target.value) } : s,
                    ),
                  )
                }
              />
              <IconButton
                type="button"
                aria-label={`역할 ${i + 1} 삭제`}
                onClick={() => setSlots(slots.filter((s) => s.id !== slot.id))}
              >
                <Icon name="imgS1Del" size={16} />
              </IconButton>
            </Row>
          ))}
          <Button
            type="button"
            tone="plain"
            onClick={() => setSlots([...slots, { id: Date.now(), role: '백엔드', count: 1 }])}
          >
            <Icon name="imgAddSlotIc" size={16} />
            역할 슬롯 추가
          </Button>
        </Stack>
        <Stack gap={10}>
          <StepLabel number={4} completed={!!draft.role}>
            내가 맡은 역할
          </StepLabel>
          <Dropdown
            aria-label="내가 맡은 역할"
            value={draft.role}
            onChange={(x) => setDraft({ ...draft, role: x })}
            options={roles.map((x) => ({ value: x, label: x }))}
          />
        </Stack>
        <Stack gap={10}>
          <StepLabel number={5} completed={!!draft.preferred}>
            우대사항
          </StepLabel>
          <Input
            aria-label="우대사항"
            placeholder="우대하는 경험이나 성향을 적어주세요"
            maxLength={200}
            value={draft.preferred ?? ''}
            onChange={(e) => setDraft({ ...draft, preferred: e.target.value })}
          />
        </Stack>
        <Stack gap={10}>
          <StepLabel number={6} completed={!!draft.etc}>
            기타
          </StepLabel>
          <Input
            aria-label="기타"
            placeholder="팀원에게 전할 내용이 있다면 적어주세요"
            maxLength={200}
            value={draft.etc ?? ''}
            onChange={(e) => setDraft({ ...draft, etc: e.target.value })}
          />
        </Stack>
        <Button
          type="submit"
          fullWidth
          disabled={!slots.length || createTeam.isPending || challengesQuery.isPending}
        >
          게시하기
        </Button>
      </FormContainer>
    </UserShell>
  );
}

export const FormContainer = styled.form({
  width: 640,
  maxWidth: 'calc(100% - 32px)',
  margin: '0 auto',
  padding: '40px 0',
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
  [mobile]: { padding: '24px 0', gap: 32 },
});
