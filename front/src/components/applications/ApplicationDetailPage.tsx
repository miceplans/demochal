'use client';

import { useState, type FormEvent } from 'react';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { generated, type ApplicationFormAnswer } from '@semochal/api-client';
import { MyShell } from '@/components/common/UserShell';
import { Button, IconButton, Input, Tag } from '@/components/common/Primitives';
import { Dropdown } from '@/components/ui/Dropdown';
import { useToast } from '@/components/common/Toast';
import { apiErrorMessage } from '@/lib/api-error';
import { roles as presetRoles } from '@/data/user-design';
import { colors as c, mobile } from '@/styles/design';
import {
  ApplicationQuestions,
  fileAnswerIds,
  isAnswerValid,
  type Answers,
} from './ApplicationQuestions';

// biz 지원서 관리(ApplicationTable)의 STATUS_LABEL과 같은 매핑을 쓴다.
const STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  submitted: '제출 완료',
  reviewing: '검토중',
  needs_revision: '보완 요청',
  accepted: '합격',
  rejected: '불합격',
};
// 지원자 본인이 내용을 수정할 수 있는 상태 — 서버의 상태 가드와 동일하게 유지한다.
const EDITABLE_STATUSES = ['pending', 'submitted', 'needs_revision'];

const Stack = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 40,
  [mobile]: { gap: 28 },
});
const Header = styled.div({ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' });
const Title = styled.h1({
  margin: 0,
  color: c.gray900,
  fontSize: 24,
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: '-0.01em',
  [mobile]: { fontSize: 17, letterSpacing: 0 },
});
const Section = styled.section({ display: 'flex', flexDirection: 'column', gap: 16 });
const SectionTitle = styled.h2({
  margin: 0,
  color: c.gray900,
  fontSize: 17,
  fontWeight: 600,
  [mobile]: { fontSize: 15 },
});
const MemberList = styled.div({
  display: 'flex',
  width: 800,
  maxWidth: '100%',
  flexDirection: 'column',
  gap: 8,
  [mobile]: { gap: 10 },
});
const MemberRow = styled.div({
  display: 'flex',
  minWidth: 0,
  alignItems: 'center',
  gap: 12,
  [mobile]: { gap: 8 },
});
const MemberRole = styled.div({ width: 160, flexShrink: 0, [mobile]: { width: 110 } });
const RoleField = styled.div({ width: 240, maxWidth: '100%' });
const MemberName = styled(Input)({
  flex: 1,
  height: 40,
  [mobile]: { height: 44, textAlign: 'center', borderRadius: 10, padding: '0 12px' },
});
const AddMember = styled.button({
  display: 'flex',
  width: '100%',
  height: 44,
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 10,
  background: c.white,
  color: c.gray500,
  fontSize: 13,
  cursor: 'pointer',
  '& span': { color: c.gray700, fontSize: 18, fontWeight: 300, lineHeight: 1 },
});
const DeleteButton = styled(IconButton)({
  width: 16,
  height: 16,
  padding: 0,
  flexShrink: 0,
  color: c.gray500,
  fontSize: 18,
  lineHeight: 1,
  [mobile]: { width: 18, height: 18 },
});
const AnswerList = styled.dl({
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  '& dt': { color: c.gray900, fontWeight: 600 },
  '& dd': { margin: '6px 0 0', color: c.gray700, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
});
const AnswerValues = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
});
const Actions = styled.div({
  display: 'flex',
  width: 298,
  maxWidth: '100%',
  gap: 20,
  alignSelf: 'flex-end',
  [mobile]: { width: '100%', alignSelf: 'stretch', gap: 10 },
});
const ActionButton = styled(Button)({
  flex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  minHeight: 37,
  padding: '10px 12px',
  borderRadius: 6,
  fontSize: 12,
  [mobile]: { minHeight: 52, borderRadius: 12, fontSize: 15 },
});
const AttachmentButton = styled.button({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 10px',
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 8,
  background: c.white,
  color: c.gray700,
  fontSize: 13,
  cursor: 'pointer',
  '&:disabled': { cursor: 'not-allowed', color: c.gray500 },
});

/** 저장된 답변(questionId → value)을 편집 폼의 초기값으로 쓴다. */
function answersFromSaved(formAnswers: ApplicationFormAnswer[] | undefined): Answers {
  return Object.fromEntries((formAnswers ?? []).map((answer) => [answer.questionId, answer.value]));
}

function Attachment({
  applicationId,
  fileId,
  label,
}: {
  applicationId: string;
  fileId: string;
  label: string;
}) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const openFile = async () => {
    setPending(true);
    try {
      const response = await generated.getApplicationAttachment(applicationId, fileId);
      if (response.status !== 200) throw new Error('File unavailable');
      window.location.assign(response.data.url);
    } catch {
      toast.error('첨부파일을 열지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setPending(false);
    }
  };
  return (
    <AttachmentButton type="button" disabled={pending} onClick={() => void openFile()}>
      {pending ? '불러오는 중…' : label}
    </AttachmentButton>
  );
}

function ReadOnlyAnswers({
  applicationId,
  answers,
}: {
  applicationId: string;
  answers: ApplicationFormAnswer[];
}) {
  if (answers.length === 0) return <p>추가 질문에 대한 응답이 없습니다.</p>;
  return (
    <AnswerList>
      {answers.map((answer) => {
        const fileIds = answer.type === 'file' ? fileAnswerIds(answer.value) : [];
        return (
          <div key={answer.questionId}>
            <dt>{answer.title}</dt>
            <dd>
              {fileIds.length > 0 ? (
                <AnswerValues>
                  {fileIds.map((fileId, index) => (
                    <Attachment
                      key={fileId}
                      applicationId={applicationId}
                      fileId={fileId}
                      label={fileIds.length > 1 ? `첨부파일 ${index + 1} 열기` : '첨부파일 열기'}
                    />
                  ))}
                </AnswerValues>
              ) : (
                (Array.isArray(answer.value) ? answer.value.join(', ') : answer.value) ||
                '답변 없음'
              )}
            </dd>
          </div>
        );
      })}
    </AnswerList>
  );
}

export function ApplicationDetailPage({ applicationId }: { applicationId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const applicationQuery = generated.useGetApplication(applicationId);
  const meQuery = generated.useGetMyAuthInfo({ query: { retry: false } });
  const application =
    applicationQuery.data?.status === 200 ? applicationQuery.data.data : undefined;
  const meId = meQuery.data?.status === 200 ? meQuery.data.data.id : undefined;
  const challengeQuery = generated.useGetChallenge(application?.challengeId ?? '', {
    query: { enabled: Boolean(application) },
  });
  const challenge = challengeQuery.data?.status === 200 ? challengeQuery.data.data : undefined;
  const questions = challenge?.applicationForm ?? [];
  const updateMutation = generated.useUpdateApplication();

  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pickedRole, setPickedRole] = useState('');
  const [members, setMembers] = useState<{ name: string; role: string }[]>([]);
  const [answers, setAnswers] = useState<Answers>({});

  // 지원 역할 선택지 — 챌린지가 밀어낸 모집 역할(Challenge.roles)을 1순위로 쓴다(ApplyChallengeDto.role).
  const roleOptions = (challenge?.roles?.length ? challenge.roles : presetRoles).map((item) => ({
    value: item,
    label: item,
  }));
  const fallbackRole = roleOptions[0]?.value ?? '백엔드';
  const role = roleOptions.some((option) => option.value === pickedRole)
    ? pickedRole
    : fallbackRole;
  const normalizedMembers = members.map((member) =>
    roleOptions.some((option) => option.value === member.role)
      ? member
      : { ...member, role: fallbackRole },
  );

  const canEdit =
    Boolean(application) &&
    meId === application?.userId &&
    EDITABLE_STATUSES.includes(application?.status ?? '');

  const startEdit = () => {
    if (!application) return;
    setPickedRole(application.role ?? '');
    setMembers(
      (application.teammates ?? []).map((name) => ({ name, role: application.role ?? '' })),
    );
    setAnswers(answersFromSaved(application.formAnswers));
    setEditing(true);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!application || updateMutation.isPending || uploading) return;
    if (!challenge) {
      toast.error('공고 정보를 불러온 뒤 다시 저장해 주세요.');
      return;
    }
    const invalid = questions.find((question) => !isAnswerValid(question, answers[question.id]));
    if (invalid) {
      toast.error(`“${invalid.title}” 답변을 확인해 주세요.`);
      return;
    }
    if (normalizedMembers.some((member) => !member.name.trim())) {
      toast.error('팀원 이름을 입력해 주세요.');
      return;
    }
    try {
      const response = await updateMutation.mutateAsync({
        id: applicationId,
        data: {
          role,
          teammates: normalizedMembers.map((member) => member.name),
          formAnswers: questions
            .filter((question) => answers[question.id] !== undefined)
            .map((question) => ({ questionId: question.id, value: answers[question.id]! })),
        },
      });
      if (response.status !== 200) throw new Error('Update rejected');
      await queryClient.invalidateQueries({
        queryKey: generated.getGetApplicationQueryKey(applicationId),
      });
      await queryClient.invalidateQueries({ queryKey: generated.getListMyApplicationsQueryKey() });
      setEditing(false);
      toast.success('지원서를 수정했어요');
    } catch (error) {
      toast.error('수정에 실패했어요', apiErrorMessage(error, '잠시 후 다시 시도해주세요'));
    }
  };

  if (applicationQuery.isPending) {
    return (
      <MyShell title="지원서 상세">
        <p>불러오는 중이에요.</p>
      </MyShell>
    );
  }
  if (applicationQuery.isError || !application) {
    return (
      <MyShell title="지원서 상세">
        <p>지원서를 불러오지 못했어요. 새로고침해주세요.</p>
      </MyShell>
    );
  }

  const readMode = (
    <Stack>
      <Header>
        <Title>{challenge?.title ?? application.challengeTitle ?? '챌린지 지원서'}</Title>
        <Tag tone="blue">{STATUS_LABEL[application.status] ?? application.status}</Tag>
      </Header>
      <Section>
        <SectionTitle>지원 역할</SectionTitle>
        <p>{application.role ?? '-'}</p>
      </Section>
      <Section>
        <SectionTitle>팀원 구성</SectionTitle>
        {application.teammates.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, color: c.gray700 }}>
            {application.teammates.map((name, index) => (
              <li key={`${name}-${index}`}>{name}</li>
            ))}
          </ul>
        ) : (
          <p>팀원이 없습니다.</p>
        )}
      </Section>
      <Section>
        <SectionTitle>지원서 답변</SectionTitle>
        <ReadOnlyAnswers applicationId={applicationId} answers={application.formAnswers ?? []} />
      </Section>
      {canEdit && (
        <Actions>
          <ActionButton type="button" onClick={startEdit}>
            수정
          </ActionButton>
        </Actions>
      )}
    </Stack>
  );

  return (
    <MyShell title="지원서 상세">
      {editing ? (
        <form onSubmit={handleSave}>
          <Stack>
            <Header>
              <Title>{challenge?.title ?? application.challengeTitle ?? '챌린지 지원서'}</Title>
              <Tag tone="blue">{STATUS_LABEL[application.status] ?? application.status}</Tag>
            </Header>
            <Section>
              <SectionTitle>지원 역할</SectionTitle>
              <RoleField>
                <Dropdown
                  aria-label="지원 역할"
                  value={role}
                  onChange={setPickedRole}
                  options={roleOptions}
                />
              </RoleField>
            </Section>
            <Section>
              <SectionTitle>팀원 구성</SectionTitle>
              <MemberList>
                {normalizedMembers.map((member, index) => (
                  <MemberRow key={index}>
                    <MemberRole>
                      <Dropdown
                        aria-label={`팀원 ${index + 1} 역할`}
                        size="S"
                        value={member.role}
                        onChange={(value) =>
                          setMembers(
                            members.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, role: value } : item,
                            ),
                          )
                        }
                        options={roleOptions}
                      />
                    </MemberRole>
                    <MemberName
                      required
                      aria-label={`팀원 ${index + 1} 이름`}
                      placeholder="이름"
                      value={member.name}
                      onChange={(event) =>
                        setMembers(
                          members.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, name: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <DeleteButton
                      type="button"
                      aria-label={`팀원 ${index + 1} 삭제`}
                      onClick={() =>
                        setMembers(members.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      ×
                    </DeleteButton>
                  </MemberRow>
                ))}
                <AddMember
                  type="button"
                  onClick={() => setMembers([...members, { name: '', role: fallbackRole }])}
                >
                  <span aria-hidden="true">+</span>팀원 추가
                </AddMember>
              </MemberList>
            </Section>
            <Section>
              <SectionTitle>지원서 답변</SectionTitle>
              <ApplicationQuestions
                questions={questions}
                answers={answers}
                onChange={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))}
                onUploading={setUploading}
                disabled={updateMutation.isPending || uploading}
              />
            </Section>
            <Actions>
              <ActionButton
                type="button"
                tone="plain"
                onClick={() => setEditing(false)}
                disabled={updateMutation.isPending}
              >
                취소
              </ActionButton>
              <ActionButton type="submit" disabled={updateMutation.isPending || uploading}>
                {uploading ? '첨부파일 업로드 중…' : updateMutation.isPending ? '처리 중…' : '저장'}
              </ActionButton>
            </Actions>
          </Stack>
        </form>
      ) : (
        readMode
      )}
    </MyShell>
  );
}
