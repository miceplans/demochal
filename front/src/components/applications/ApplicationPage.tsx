'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserShell } from '@/components/common/UserShell';
import { Button, Input, Select, Stack, Row, Title } from '@/components/common/Primitives';
import { FormContainer, StepLabel } from '@/components/teams/RecruitmentPage';
import { roles } from '@/data/user-design';
import { useUserStore } from '@/stores/useUserStore';
import { useToast } from '@/components/common/Toast';
export function ApplicationPage() {
  const draft = useUserStore((s) => s.applicationDraft);
  const save = useUserStore((s) => s.saveApplication);
  const toast = useToast();
  const router = useRouter();
  const [role, setRole] = useState(draft?.role ?? '백엔드');
  const [members, setMembers] = useState(
    draft?.members ?? [
      { name: '김민수', role: '백엔드' },
      { name: '이지현', role: '프론트엔드' },
    ],
  );
  return (
    <UserShell title="지원서 작성" back="/contests/public-data">
      <FormContainer
        onSubmit={(e) => {
          e.preventDefault();
          save({ role, members });
          toast.success('지원서를 저장했어요.');
          router.push('/my/applications');
        }}
      >
        <Title>2025 지역문제 해결 해커톤 신청서</Title>
        <Stack gap={12}>
          <StepLabel number={1}>역할이 무엇인가요?</StepLabel>
          <Select aria-label="지원 역할" value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </Stack>
        <Stack gap={12}>
          <StepLabel number={2}>팀원구성을 작성해주세요</StepLabel>
          {members.map((m, i) => (
            <Row key={i}>
              <Select
                aria-label={`팀원 ${i + 1} 역할`}
                value={m.role}
                style={{ flex: 1 }}
                onChange={(e) =>
                  setMembers(members.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))
                }
              >
                {roles.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Select>
              <Input
                required
                aria-label={`팀원 ${i + 1} 이름`}
                placeholder="이름"
                value={m.name}
                style={{ flex: 1 }}
                onChange={(e) =>
                  setMembers(members.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                }
              />
            </Row>
          ))}
          <Button
            tone="plain"
            type="button"
            onClick={() => setMembers([...members, { name: '', role: '백엔드' }])}
          >
            팀원 추가
          </Button>
        </Stack>
        <Row style={{ justifyContent: 'flex-end' }}>
          <Button
            type="button"
            tone="outline"
            onClick={() => {
              save({ role, members });
              toast.success('임시저장했어요.');
            }}
          >
            임시저장
          </Button>
          <Button type="submit">제출</Button>
        </Row>
      </FormContainer>
    </UserShell>
  );
}
