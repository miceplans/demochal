'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { UserShell } from '@/components/common/UserShell';
import {
  Button,
  Input,
  Select,
  Stack,
  Row,
  Icon,
  IconButton,
  DesktopOnly,
  Title,
} from '@/components/common/Primitives';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { roles } from '@/data/user-design';
import { useUserStore } from '@/stores/useUserStore';
import { useToast } from '@/components/common/Toast';
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
export function StepLabel({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <Row gap={8} style={textStyle.bodyStrong}>
      <span
        style={{
          width: 24,
          height: 24,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          background: number === 1 ? c.primary : c.white,
          border: `1px solid ${c.primary}`,
          color: number === 1 ? c.white : c.primary,
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
  const draft = useUserStore((s) => s.recruitment);
  const setDraft = useUserStore((s) => s.setRecruitment);
  const toast = useToast();
  const router = useRouter();
  const [slots, setSlots] = useState([
    { id: 1, role: '백엔드', count: 1 },
    { id: 2, role: '디자이너', count: 1 },
  ]);
  return (
    <UserShell title="모집글 작성" back="/teams" footer={false}>
      <FormContainer
        onSubmit={(e) => {
          e.preventDefault();
          toast.success('모집글을 저장했어요.');
          router.push('/my/teams');
        }}
      >
        <DesktopOnly>
          <Title>모집글 작성</Title>
        </DesktopOnly>
        <Stack gap={10}>
          <StepLabel number={1}>챌린지 선택</StepLabel>
          <Input
            list="challenges"
            aria-label="챌린지 선택"
            placeholder="챌린지를 검색하세요"
            required
            value={draft.challenge}
            onChange={(e) => setDraft({ ...draft, challenge: e.target.value })}
          />
          <datalist id="challenges">
            <option>2025 공공데이터 활용 창업 대회</option>
            <option>2025 지역문제 해결 해커톤</option>
          </datalist>
        </Stack>
        <Stack gap={10}>
          <StepLabel number={2}>팀 소개 한줄</StepLabel>
          <Input
            aria-label="팀 소개 한줄"
            placeholder="팀을 한 줄로 소개해주세요"
            required
            maxLength={100}
            value={draft.introduction}
            onChange={(e) => setDraft({ ...draft, introduction: e.target.value })}
          />
        </Stack>
        <Stack gap={10}>
          <StepLabel number={3}>필요 역할 슬롯 추가</StepLabel>
          {slots.map((slot, i) => (
            <Row key={slot.id}>
              <Select
                aria-label={`모집 역할 ${i + 1}`}
                value={slot.role}
                style={{ flex: 1 }}
                onChange={(e) =>
                  setSlots(
                    slots.map((s) => (s.id === slot.id ? { ...s, role: e.target.value } : s)),
                  )
                }
              >
                {roles.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Select>
              <Input
                type="number"
                aria-label={`모집 인원 ${i + 1}`}
                min={1}
                max={10}
                value={slot.count}
                style={{ width: 80 }}
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
                <Icon frame="195-1250" name="imgS1Del" size={16} />
              </IconButton>
            </Row>
          ))}
          <Button
            type="button"
            tone="plain"
            onClick={() => setSlots([...slots, { id: Date.now(), role: '백엔드', count: 1 }])}
          >
            <Icon frame="195-1250" name="imgAddSlotIc" size={16} />
            역할 슬롯 추가
          </Button>
        </Stack>
        <Stack gap={10}>
          <StepLabel number={4}>내가 맡은 역할</StepLabel>
          <Select
            aria-label="내가 맡은 역할"
            value={draft.role}
            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
          >
            {roles.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </Stack>
        <Button type="submit" fullWidth disabled={!slots.length}>
          게시하기
        </Button>
      </FormContainer>
    </UserShell>
  );
}
