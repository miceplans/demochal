'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { LOCAL_ERROR_TOAST_META, useToast } from '@/components/common/Toast';
import {
  AdminInlineNotice,
  AdminPageTitle,
  AdminSectionTitle,
  ApproveButton,
  Badge,
  RejectButton,
} from './parts';
import { useAdminHref } from './AdminShell';

const EMPTY = '작성되지 않았어요';

const Section = styled.section({ display: 'flex', flexDirection: 'column', gap: 16 });
const Panel = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  padding: 24,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 12,
  background: c.white,
});
const Field = styled.div({ display: 'flex', flexDirection: 'column', gap: 4 });
const Label = styled.span({ ...textStyle.metaText, color: c.gray500 });
const LabelFor = styled.label({ ...textStyle.metaText, color: c.gray500 });
const Text = styled.p({
  margin: 0,
  ...textStyle.bodySmall,
  color: c.gray900,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
});
const TitleRow = styled.div({ display: 'flex', alignItems: 'center', gap: 12 });
const ReportItem = styled.li({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '12px 0',
  borderTop: `0.5px solid ${c.gray200}`,
  '&:first-of-type': { borderTop: 0, paddingTop: 0 },
});
const ReportList = styled.ul({ margin: 0, padding: 0, listStyle: 'none' });
const ReasonTextarea = styled.textarea({
  width: '100%',
  boxSizing: 'border-box',
  resize: 'vertical',
  padding: '10px 12px',
  border: `0.5px solid ${c.gray300}`,
  borderRadius: 8,
  color: c.gray900,
  ...textStyle.bodySmall,
  '&:focus': { outline: 'none', borderColor: c.primary },
});
const Actions = styled.div({ display: 'flex', justifyContent: 'flex-end', gap: 8 });

const formatDate = (iso: string) => (iso ? iso.slice(0, 10) : '');
const statusLabel = (status: string) => (status === 'rejected' ? '반려됨' : status);

function Item({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <Field>
      <Label>{label}</Label>
      <Text>{children || EMPTY}</Text>
    </Field>
  );
}

type ReportEntry = {
  id?: string;
  summary?: string;
  detail?: string | null;
  reporter?: string;
  reportedAt?: string;
  status?: string;
};

function Reports({ reports }: { reports: ReportEntry[] }) {
  return (
    <Section>
      <AdminSectionTitle>접수된 신고</AdminSectionTitle>
      <Panel>
        {reports.length === 0 ? (
          <Text>접수된 신고가 없어요.</Text>
        ) : (
          <ReportList>
            {reports.map((report) => (
              <ReportItem key={report.id}>
                <Text>
                  <strong>{report.summary}</strong>
                  {report.status === 'open' ? ' · 처리 대기' : ' · 처리됨'}
                </Text>
                {report.detail ? <Text>{report.detail}</Text> : null}
                <Label>
                  {[report.reporter, formatDate(report.reportedAt ?? '')]
                    .filter(Boolean)
                    .join(' · ')}
                </Label>
              </ReportItem>
            ))}
          </ReportList>
        )}
      </Panel>
    </Section>
  );
}

/** 하단 `이전` / `반려하기` — 반려 사유는 필수이며 작성자에게 알림·이메일로 전달된다. */
function RejectBar({
  rejected,
  pending,
  onReject,
}: {
  rejected: boolean;
  pending: boolean;
  onReject: (reason: string) => void;
}) {
  const router = useRouter();
  const hrefOf = useAdminHref();
  const [reason, setReason] = useState('');
  return (
    <Section>
      {rejected ? null : (
        <Field>
          <LabelFor htmlFor="content-reject-reason">반려 사유</LabelFor>
          <ReasonTextarea
            id="content-reject-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="반려 사유를 입력해주세요 (작성자에게 알림과 이메일로 전달돼요)"
            maxLength={500}
            rows={4}
          />
        </Field>
      )}
      <Actions>
        <RejectButton type="button" onClick={() => router.push(hrefOf('/contents'))}>
          이전
        </RejectButton>
        <ApproveButton
          type="button"
          disabled={rejected || pending || !reason.trim()}
          onClick={() => onReject(reason.trim())}
        >
          {rejected ? '반려됨' : pending ? '처리 중…' : '반려하기'}
        </ApproveButton>
      </Actions>
    </Section>
  );
}

function useRejectHandlers() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const hrefOf = useAdminHref();
  return {
    onSuccess: () => {
      toast.success('반려하고 알림을 보냈어요.');
      void queryClient.invalidateQueries({ queryKey: generated.getListAdminContentsQueryKey() });
      router.push(hrefOf('/contents'));
    },
    onError: () => toast.error('반려에 실패했어요', '잠시 후 다시 시도해주세요'),
  };
}

export function AdminTeamDetailScreen({ id }: { id: string }) {
  const query = generated.useGetAdminTeamDetail(id, {
    query: { meta: LOCAL_ERROR_TOAST_META },
  });
  const reject = generated.useRejectAdminTeam({ mutation: useRejectHandlers() });
  const team = query.data?.status === 200 ? query.data.data : undefined;

  if (query.isPending) return <AdminInlineNotice>불러오는 중...</AdminInlineNotice>;
  if (!team) return <AdminInlineNotice>팀을 불러올 수 없어요.</AdminInlineNotice>;

  return (
    <>
      <TitleRow>
        <AdminPageTitle>{team.name}</AdminPageTitle>
        {team.status === 'rejected' ? <Badge tone="red">{statusLabel(team.status)}</Badge> : null}
      </TitleRow>
      <Section>
        <AdminSectionTitle>모집글 내용</AdminSectionTitle>
        <Panel>
          <Item label="소속 챌린지">{team.challenge}</Item>
          <Item label="팀장">
            {[team.leaderName, team.leaderRole, team.region].filter(Boolean).join(' · ')}
          </Item>
          <Item label="모집 역할">
            {(team.openRoles ?? []).map((slot) => `${slot.role} ${slot.count}명`).join(', ')}
          </Item>
          <Item label="참여 팀원">
            {(team.members ?? [])
              .map((member) => [member.name, member.role].filter(Boolean).join(' · '))
              .join('\n')}
          </Item>
          <Item label="팀 소개">{team.introduction}</Item>
          <Item label="우대사항">{team.preferred}</Item>
          <Item label="기타">{team.etc}</Item>
          <Item label="등록일">{formatDate(team.createdAt ?? '')}</Item>
        </Panel>
      </Section>
      <Reports reports={team.reports ?? []} />
      <RejectBar
        rejected={team.status === 'rejected'}
        pending={reject.isPending}
        onReject={(reason) => reject.mutate({ id, data: { reason } })}
      />
    </>
  );
}

export function AdminChallengeDetailScreen({ id }: { id: string }) {
  const query = generated.useGetAdminChallengeDetail(id, {
    query: { meta: LOCAL_ERROR_TOAST_META },
  });
  const reject = generated.useRejectAdminChallenge({ mutation: useRejectHandlers() });
  const challenge = query.data?.status === 200 ? query.data.data : undefined;

  if (query.isPending) return <AdminInlineNotice>불러오는 중...</AdminInlineNotice>;
  if (!challenge) return <AdminInlineNotice>공고를 불러올 수 없어요.</AdminInlineNotice>;

  return (
    <>
      <TitleRow>
        <AdminPageTitle>{challenge.title}</AdminPageTitle>
        {challenge.status === 'rejected' ? (
          <Badge tone="red">{statusLabel(challenge.status)}</Badge>
        ) : null}
      </TitleRow>
      <Section>
        <AdminSectionTitle>공고 내용</AdminSectionTitle>
        <Panel>
          <Item label="주최 기관">{challenge.organization}</Item>
          <Item label="카테고리">{challenge.category}</Item>
          <Item label="한줄 소개">{challenge.summary}</Item>
          <Item label="접수 기간">
            {`${formatDate(challenge.startDate ?? '')} ~ ${formatDate(challenge.endDate ?? '')}`}
          </Item>
          <Item label="모집 인원 · 참가비">
            {`${challenge.capacity ?? 0}명 · ${
              (challenge.price ?? 0) > 0 ? `${challenge.price?.toLocaleString()}원` : '무료'
            }`}
          </Item>
          <Item label="총상금">
            {challenge.prizeAmount ? `${challenge.prizeAmount.toLocaleString()}만원` : ''}
          </Item>
          <Item label="대상">{(challenge.targets ?? []).join(', ')}</Item>
          <Item label="해시태그">
            {(challenge.hashtags ?? []).map((tag) => `#${tag}`).join(' ')}
          </Item>
          <Item label="지원 방식">
            {challenge.recruitMethod === 'external'
              ? `외부 링크 ${challenge.recruitUrl ?? ''}`.trim()
              : '세모챌 신청서'}
          </Item>
          <Item label="팀 모집">{`${challenge.teamsCount ?? 0}건`}</Item>
          <Item label="공고 본문">{challenge.description}</Item>
        </Panel>
      </Section>
      <Reports reports={challenge.reports ?? []} />
      <RejectBar
        rejected={challenge.status === 'rejected'}
        pending={reject.isPending}
        onReject={(reason) => reject.mutate({ id, data: { reason } })}
      />
    </>
  );
}
