'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { UserShell } from '@/components/common/UserShell';
import { Button, IconButton, Input } from '@/components/common/Primitives';
import { Dropdown } from '@/components/ui/Dropdown';
import { roles } from '@/data/user-design';
import { useUserStore } from '@/stores/useUserStore';
import { useToast } from '@/components/common/Toast';
import { colors as c, mobile } from '@/styles/design';

const Form = styled.form({
  display: 'flex', flexDirection: 'column', gap: 60, width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '60px 120px', minHeight: 724,
  '@media (max-width: 900px)': { padding: '48px clamp(32px, 8vw, 80px)' },
  [mobile]: { minHeight: 'calc(100dvh - 44px)', gap: 28, padding: '20px 16px 32px' },
});
const FormTitle = styled.h1({
  display: 'flex', alignItems: 'center', gap: 14, color: c.gray900, fontSize: 40, fontWeight: 600,
  minWidth: 0, lineHeight: 1.3, letterSpacing: '-0.02em',
  '@media (max-width: 900px)': { fontSize: 32 },
  [mobile]: { gap: 8, fontSize: 20, letterSpacing: 0 },
});
const Content = styled.div({ display: 'flex', flexDirection: 'column', gap: 60, [mobile]: { gap: 28 } });
const Step = styled.section({ display: 'flex', flexDirection: 'column', gap: 32, [mobile]: { gap: 14 } });
const StepHeading = styled.div({ display: 'flex', alignItems: 'center', gap: 8 });
const StepNumber = styled.span<{ $completed: boolean }>(({ $completed }) => ({
  display: 'grid', width: 30, height: 30, placeItems: 'center', flexShrink: 0,
  border: `${$completed ? 0 : 1.25}px solid ${c.primary}`, borderRadius: '50%', background: $completed ? c.primary : c.white,
  color: $completed ? c.white : c.primary, fontSize: 20, fontWeight: 600,
  [mobile]: { width: 26, height: 26, fontSize: 14 },
}));
const StepText = styled.h2({
  color: c.gray900, fontSize: 24, fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.01em',
  [mobile]: { fontSize: 17, letterSpacing: 0 },
});
const FieldWidth = styled.div({ width: 800, maxWidth: '100%' });
const MemberList = styled.div({
  display: 'flex', width: 800, maxWidth: '100%', flexDirection: 'column', gap: 8, [mobile]: { gap: 10 },
});
const MemberRow = styled.div({ display: 'flex', minWidth: 0, alignItems: 'center', gap: 12, [mobile]: { gap: 8 } });
const MemberRole = styled.div({ width: 160, flexShrink: 0, [mobile]: { width: 110 } });
const MemberName = styled(Input)({
  flex: 1, height: 40, [mobile]: { height: 44, textAlign: 'center', borderRadius: 10, padding: '0 12px' },
});
const AddMember = styled.button({
  display: 'flex', width: '100%', height: 44, alignItems: 'center', justifyContent: 'center', gap: 6, border: `1px solid ${c.gray100}`,
  borderRadius: 10, background: c.white, color: c.gray500, fontSize: 13,
  '& span': { color: c.gray700, fontSize: 18, fontWeight: 300, lineHeight: 1 },
});
const Actions = styled.div({
  display: 'flex', width: 298, maxWidth: '100%', alignSelf: 'flex-end', gap: 20,
  [mobile]: { width: '100%', alignSelf: 'stretch', gap: 10, marginTop: 'auto' },
});
const ActionButton = styled(Button)({
  flex: 1, minHeight: 37, padding: '10px 12px', borderRadius: 6, fontSize: 12,
  [mobile]: { minHeight: 52, borderRadius: 12, fontSize: 15 },
});
const DeleteButton = styled(IconButton)({
  width: 16, height: 16, padding: 0, flexShrink: 0, color: c.gray500, fontSize: 18, lineHeight: 1,
  [mobile]: { width: 18, height: 18 },
});

export function ApplicationPage() {
  const draft = useUserStore((s) => s.applicationDraft);
  const save = useUserStore((s) => s.saveApplication);
  const toast = useToast();
  const router = useRouter();
  const [role, setRole] = useState(draft?.role ?? '백엔드');
  const [members, setMembers] = useState(draft?.members ?? [{ name: '', role: '백엔드' }]);
  const membersComplete = members.length > 0 && members.every((member) => member.name.trim());
  const saveDraft = () => { save({ role, members }); toast.success('임시저장했어요.'); };

  return (
    <UserShell title="지원서 작성" back="/contests/public-data" footer={false}>
      <Form onSubmit={(event) => {
        event.preventDefault(); save({ role, members }); toast.success('지원서를 저장했어요.'); router.push('/my/applications');
      }}>
        <Content>
          <FormTitle>
            2025 지역문제 해결 해커톤 신청서
          </FormTitle>
          <Step>
            <StepHeading><StepNumber $completed={Boolean(role)}>1</StepNumber><StepText>역할이 무엇인가요?</StepText></StepHeading>
            <FieldWidth><Dropdown aria-label="지원 역할" value={role} onChange={setRole} options={roles.map((item) => ({ value: item, label: item }))} /></FieldWidth>
          </Step>
          <Step>
            <StepHeading><StepNumber $completed={membersComplete}>2</StepNumber><StepText>팀원구성을 작성해주세요</StepText></StepHeading>
            <MemberList>
              {members.map((member, index) => (
                <MemberRow key={index}>
                  <MemberRole><Dropdown aria-label={`팀원 ${index + 1} 역할`} size="S" value={member.role} onChange={(value) => setMembers(members.map((item, itemIndex) => itemIndex === index ? { ...item, role: value } : item))} options={roles.map((item) => ({ value: item, label: item }))} /></MemberRole>
                  <MemberName required aria-label={`팀원 ${index + 1} 이름`} placeholder="이름" value={member.name} style={{ color: member.name ? c.gray900 : c.gray500 }} onChange={(event) => setMembers(members.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
                  <DeleteButton type="button" aria-label={`팀원 ${index + 1} 삭제`} onClick={() => setMembers(members.filter((_, itemIndex) => itemIndex !== index))}>×</DeleteButton>
                </MemberRow>
              ))}
              <AddMember type="button" onClick={() => setMembers([...members, { name: '', role: '백엔드' }])}><span aria-hidden="true">+</span>팀원 추가</AddMember>
            </MemberList>
          </Step>
        </Content>
        <Actions>
          <ActionButton type="button" tone="plain" onClick={saveDraft}>임시저장</ActionButton>
          <ActionButton type="submit">제출</ActionButton>
        </Actions>
      </Form>
    </UserShell>
  );
}
