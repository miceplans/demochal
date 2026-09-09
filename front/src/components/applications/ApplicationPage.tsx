'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserShell } from '@/components/common/UserShell';
import { Button, Input, Stack, Row, Title } from '@/components/common/Primitives';
import { Dropdown } from '@/components/ui/Dropdown';
import { FormContainer, StepLabel } from '@/components/teams/RecruitmentPage';
import { roles } from '@/data/user-design';
import { useUserStore } from '@/stores/useUserStore';
import { useToast } from '@/components/common/Toast';
import { colors as c } from '@/styles/design';
export function ApplicationPage() {
  const draft = useUserStore((s) => s.applicationDraft);
  const save = useUserStore((s) => s.saveApplication);
  const toast = useToast();
  const router = useRouter();
  const [role, setRole] = useState(draft?.role ?? '백엔드');
  const [members, setMembers] = useState(draft?.members ?? [{ name: '', role: '백엔드' }]);
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
          <StepLabel number={1} completed={!!role}>
            역할이 무엇인가요?
          </StepLabel>
          <Dropdown
            aria-label="지원 역할"
            value={role}
            onChange={setRole}
            options={roles.map((x) => ({ value: x, label: x }))}
          />
        </Stack>
        <Stack gap={12}>
          <StepLabel
            number={2}
            completed={members.length > 0 && members.every((m) => m.name.trim())}
          >
            팀원구성을 작성해주세요
          </StepLabel>
          {members.map((m, i) => (
            <Row key={i}>
              <Dropdown
                aria-label={`팀원 ${i + 1} 역할`}
                size="S"
                value={m.role}
                style={{ flex: 1 }}
                onChange={(x) =>
                  setMembers(members.map((v, j) => (j === i ? { ...v, role: x } : v)))
                }
                options={roles.map((x) => ({ value: x, label: x }))}
              />
              <Input
                required
                aria-label={`팀원 ${i + 1} 이름`}
                placeholder="이름"
                value={m.name}
                style={{ flex: 1, color: m.name ? c.gray900 : c.gray500 }}
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
