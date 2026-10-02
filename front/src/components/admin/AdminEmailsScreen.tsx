'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { adminEmailApi } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  type AdminColumn,
  AdminInlineNotice,
  AdminTable,
  AdminPageTitle,
  Badge,
  FilterBar,
  SearchFilter,
} from './parts';

const statusLabel: Record<string, string> = { open: '미처리', pending: '처리중', resolved: '완료' };
const statusValue: Record<string, string> = { 미처리: 'open', 처리중: 'pending', 완료: 'resolved' };
const statusOptions = [
  { value: '', label: '전체' },
  { value: 'open', label: '미처리' },
  { value: 'pending', label: '처리중' },
  { value: 'resolved', label: '완료' },
] as const;

function formatTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminEmailsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const params = {
    q: query || undefined,
    status: statusValue[status] as 'open' | 'pending' | 'resolved' | undefined,
  };
  const list = adminEmailApi.useListAdminEmails(params);
  const overview = adminEmailApi.useListAdminEmails();
  const rows = list.data?.status === 200 ? list.data.data : [];
  const overviewRows = overview.data?.status === 200 ? overview.data.data : [];
  const counts = useMemo(
    () => ({
      total: overviewRows.length,
      open: overviewRows.filter((row) => row.status === 'open').length,
      pending: overviewRows.filter((row) => row.status === 'pending').length,
      resolved: overviewRows.filter((row) => row.status === 'resolved').length,
    }),
    [overviewRows],
  );
  const tableRows = rows.filter((row): row is typeof row & { id: string } => Boolean(row.id));
  const columns: AdminColumn<(typeof tableRows)[number]>[] = [
    {
      key: 'subject',
      header: '메일',
      render: (row) => (
        <MailCell>
          <MailIcon aria-hidden>✉</MailIcon>
          <MailCopy>
            <MailSubject>{row.subject || '(제목 없음)'}</MailSubject>
            <MailCustomer>{row.customerEmail || '고객 주소 없음'}</MailCustomer>
          </MailCopy>
        </MailCell>
      ),
    },
    {
      key: 'lastMessage',
      header: '마지막 메시지',
      render: (row) => <PreviewCell>{row.lastMessage || '-'}</PreviewCell>,
    },
    {
      key: 'lastMessageAt',
      header: '최근 시각',
      render: (row) => <TimeCell>{formatTime(row.lastMessageAt)}</TimeCell>,
    },
    {
      key: 'status',
      header: '상태',
      render: (row) => (
        <Badge>{row.status ? (statusLabel[row.status] ?? row.status) : '미처리'}</Badge>
      ),
    },
  ];

  return (
    <Screen>
      <TitleRow>
        <PageHeading>
          <AdminPageTitle>메일함</AdminPageTitle>
          <PageDescription>고객 문의를 확인하고 빠르게 답장하세요.</PageDescription>
        </PageHeading>
        <HeaderActions>
          <GhostButton
            type="button"
            onClick={() => void Promise.all([list.refetch(), overview.refetch()])}
          >
            ↻ 새로고침
          </GhostButton>
          <ComposeButton type="button" onClick={() => router.push('/admin/emails/compose')}>
            + 새 메일
          </ComposeButton>
        </HeaderActions>
      </TitleRow>
      <StatsGrid>
        <StatBox>
          <StatLabel>전체 메일</StatLabel>
          <StatValue>{counts.total}</StatValue>
          <StatHint>전체 고객 문의</StatHint>
        </StatBox>
        <StatBox accent="#2563EB">
          <StatLabel>미처리</StatLabel>
          <StatValue>{counts.open}</StatValue>
          <StatHint>확인이 필요한 메일</StatHint>
        </StatBox>
        <StatBox accent="#D97706">
          <StatLabel>처리중</StatLabel>
          <StatValue>{counts.pending}</StatValue>
          <StatHint>답변 진행 중</StatHint>
        </StatBox>
        <StatBox accent="#16A34A">
          <StatLabel>완료</StatLabel>
          <StatValue>{counts.resolved}</StatValue>
          <StatHint>처리 완료된 메일</StatHint>
        </StatBox>
      </StatsGrid>
      <FilterPanel>
        <FilterBar>
          <SearchFilter
            placeholder="제목 또는 고객 이메일 검색"
            label="제목 또는 고객 이메일 검색"
            value={query}
            onChange={setQuery}
          />
          <StatusTabs>
            {statusOptions.map((option) => (
              <StatusTab
                key={option.value}
                type="button"
                active={statusValue[status] === option.value || (!status && option.value === '')}
                onClick={() => setStatus(option.value ? statusLabel[option.value] : '')}
              >
                {option.label}
                {option.value ? (
                  <TabCount>{counts[option.value as 'open' | 'pending' | 'resolved']}</TabCount>
                ) : null}
              </StatusTab>
            ))}
          </StatusTabs>
        </FilterBar>
        {query || status ? (
          <ResetButton
            type="button"
            onClick={() => {
              setQuery('');
              setStatus('');
            }}
          >
            필터 초기화
          </ResetButton>
        ) : null}
      </FilterPanel>
      {list.isPending ? <AdminInlineNotice>메일을 불러오는 중이에요.</AdminInlineNotice> : null}
      {list.isError ? (
        <AdminInlineNotice role="alert">
          메일을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </AdminInlineNotice>
      ) : null}
      <TableCard>
        <TableToolbar>
          <strong>고객 문의</strong>
          <TableMeta>{tableRows.length}개</TableMeta>
        </TableToolbar>
        <AdminTable
          columns={columns}
          rows={tableRows}
          onRowClick={(row) => router.push(`/admin/emails/${row.id}`)}
        />
      </TableCard>
    </Screen>
  );
}

export function AdminEmailComposeScreen() {
  const router = useRouter();
  const compose = adminEmailApi.useCreateAdminEmail();
  return (
    <Screen>
      <TitleRow>
        <AdminPageTitle>새 메일 작성</AdminPageTitle>
        <BackButton type="button" onClick={() => router.push('/admin/emails')}>
          메일함으로
        </BackButton>
      </TitleRow>
      <ComposeIntro>
        <ComposeIcon aria-hidden>✉</ComposeIcon>
        <div>
          <ComposeTitle>새 고객지원 메일</ComposeTitle>
          <ComposeHint>
            고객에게 보낼 메일을 작성하세요. 발신 주소는 help@semochall.com입니다.
          </ComposeHint>
        </div>
      </ComposeIntro>
      <ComposePanel
        sending={compose.isPending}
        error={
          compose.isError
            ? '메일 발송에 실패했어요. 입력한 내용으로 다시 시도해 주세요.'
            : undefined
        }
        onSend={async (data) => {
          try {
            await compose.mutateAsync(data);
            router.push('/admin/emails');
            return true;
          } catch {
            return false;
          }
        }}
      />
    </Screen>
  );
}

export function AdminEmailThreadScreen({ id }: { id: string }) {
  const router = useRouter();
  const detail = adminEmailApi.useGetAdminEmail(id, { enabled: true });
  const reply = adminEmailApi.useSendAdminEmailReply();
  const statusMutation = adminEmailApi.useUpdateAdminEmailStatus();
  const selected = detail.data?.status === 200 ? detail.data.data : undefined;
  const [copied, setCopied] = useState(false);
  return (
    <Screen>
      <TitleRow>
        <AdminPageTitle>메일 보기</AdminPageTitle>
        <BackButton type="button" onClick={() => router.push('/admin/emails')}>
          메일함으로
        </BackButton>
      </TitleRow>
      <Detail>
        {detail.isPending ? <AdminInlineNotice>대화를 불러오는 중이에요.</AdminInlineNotice> : null}
        {detail.isError ? (
          <AdminInlineNotice role="alert">
            메일을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
          </AdminInlineNotice>
        ) : null}
        {selected ? (
          <ThreadDetail
            thread={selected}
            sending={reply.isPending}
            statusChanging={statusMutation.isPending}
            onStatusChange={(status) => statusMutation.mutate({ id, status })}
            copied={copied}
            onCopyEmail={() => {
              if (!selected.customerEmail) return;
              const write = navigator.clipboard?.writeText;
              if (!write) return;
              void write.call(navigator.clipboard, selected.customerEmail).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              });
            }}
            onReply={async (text) => {
              try {
                await reply.mutateAsync({ id: selected.id ?? id, data: { text } });
                return true;
              } catch {
                return false;
              }
            }}
            error={
              reply.isError
                ? '답장 발송에 실패했어요. 같은 내용으로 다시 시도해 주세요.'
                : undefined
            }
          />
        ) : null}
      </Detail>
    </Screen>
  );
}

function ComposePanel({
  sending,
  error,
  onSend,
}: {
  sending: boolean;
  error?: string;
  onSend: (data: { to: string; subject: string; text: string }) => Promise<boolean>;
}) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  return (
    <ComposeForm
      aria-label="새 메일 작성"
      onSubmit={(event) => {
        event.preventDefault();
        void onSend({ to, subject, text }).then((success) => {
          if (success) {
            setTo('');
            setSubject('');
            setText('');
          }
        });
      }}
    >
      <Field>
        <FieldLabel>받는 사람</FieldLabel>
        <ComposeInput
          id="compose-to"
          type="email"
          required
          placeholder="customer@example.com"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel>제목</FieldLabel>
        <ComposeInput
          id="compose-subject"
          required
          placeholder="문의 답변을 입력하세요"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </Field>
      <ComposeTextarea
        aria-label="메일 본문"
        required
        placeholder="메일 내용을 입력하세요."
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={100000}
      />
      <ComposeFooter>
        <CharacterCount>{text.length.toLocaleString()} / 100,000자</CharacterCount>
        {error ? <Error role="alert">{error}</Error> : null}
        <ReplyButton
          type="submit"
          disabled={sending || !to.trim() || !subject.trim() || !text.trim()}
        >
          {sending ? '발송 중…' : '메일 보내기'}
        </ReplyButton>
      </ComposeFooter>
    </ComposeForm>
  );
}

type EmailMessage = {
  id?: string;
  direction?: string;
  fromAddress?: string;
  messageId?: string;
  textBody?: string | null;
  sentAt?: string | null;
  receivedAt?: string | null;
  references?: string[];
  attachments?: { filename?: string | null; contentType?: string; sizeBytes?: number | null }[];
};
type EmailThreadDetail = {
  id?: string;
  subject?: string | null;
  customerEmail?: string;
  status?: string;
  messages?: EmailMessage[];
};

function ThreadDetail({
  thread,
  sending,
  onReply,
  statusChanging,
  onStatusChange,
  copied,
  onCopyEmail,
  error,
}: {
  thread: EmailThreadDetail;
  sending: boolean;
  onReply: (text: string) => Promise<boolean>;
  statusChanging: boolean;
  onStatusChange: (status: 'open' | 'pending' | 'resolved') => void;
  copied: boolean;
  onCopyEmail: () => void;
  error?: string;
}) {
  const [text, setText] = useState('');
  return (
    <>
      <ThreadHeader>
        <div>
          <Eyebrow>고객지원 문의</Eyebrow>
          <ThreadTitle>{thread.subject || '(제목 없음)'}</ThreadTitle>
          <CustomerLine>
            {thread.customerEmail || '고객 이메일 없음'}{' '}
            <CopyButton type="button" onClick={onCopyEmail}>
              {copied ? '복사됨' : '이메일 복사'}
            </CopyButton>
          </CustomerLine>
        </div>
        <StatusActions aria-label="메일 상태 변경">
          {statusOptions
            .filter((option) => option.value)
            .map((option) => (
              <StatusAction
                key={option.value}
                type="button"
                active={thread.status === option.value}
                disabled={statusChanging}
                onClick={() => onStatusChange(option.value as 'open' | 'pending' | 'resolved')}
              >
                {option.label}
              </StatusAction>
            ))}
        </StatusActions>
      </ThreadHeader>
      <Timeline>
        {(thread.messages ?? []).map((message) => (
          <Message key={message.id} outbound={message.direction === 'outbound'}>
            <MessageMeta>
              {message.direction === 'outbound' ? '관리자' : message.fromAddress} ·{' '}
              {new Date(message.sentAt ?? message.receivedAt ?? '').toLocaleString('ko-KR')}
            </MessageMeta>
            <MessageBody>
              {message.textBody || '(HTML 본문은 안전을 위해 텍스트 fallback으로 표시됩니다.)'}
            </MessageBody>
            {message.attachments?.length ? (
              <AttachmentList>
                {message.attachments.map((attachment) => (
                  <li key={`${message.id}-${attachment.filename}`}>
                    {attachment.filename || '첨부파일'} ·{' '}
                    {attachment.contentType ?? 'application/octet-stream'} ·{' '}
                    {attachment.sizeBytes ?? 0} bytes
                  </li>
                ))}
              </AttachmentList>
            ) : null}
          </Message>
        ))}
      </Timeline>
      <ReplyBox aria-label="답장 작성">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="답장 내용을 입력하세요."
          maxLength={100000}
        />
        {error ? <Error role="alert">{error}</Error> : null}
        <ReplyButton
          type="button"
          disabled={sending || !text.trim()}
          onClick={() => {
            void onReply(text).then((success) => {
              if (success) setText('');
            });
          }}
        >
          {sending ? '발송 중…' : '답장 보내기'}
        </ReplyButton>
      </ReplyBox>
    </>
  );
}

const Screen = styled.div({ display: 'flex', flexDirection: 'column', gap: 24, minHeight: 0 });
const PageHeading = styled.div({ display: 'flex', flexDirection: 'column', gap: 6 });
const PageDescription = styled.p({ margin: 0, color: c.gray500, ...textStyle.body });
const HeaderActions = styled.div({ display: 'flex', alignItems: 'center', gap: 8 });
const GhostButton = styled.button({
  height: 40,
  padding: '0 14px',
  border: `1px solid ${c.gray300}`,
  borderRadius: 7,
  background: c.white,
  color: c.gray700,
  cursor: 'pointer',
  ...textStyle.subtitle,
  '&:hover': { background: c.gray50 },
});
const StatsGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 12,
  '@media (max-width: 760px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
});
const StatBox = styled.div<{ accent?: string }>(({ accent = c.gray300 }) => ({
  padding: '17px 18px',
  border: `1px solid ${c.gray200}`,
  borderTop: `3px solid ${accent}`,
  borderRadius: 10,
  background: c.white,
  boxShadow: '0 2px 8px rgba(17,24,39,.03)',
}));
const StatLabel = styled.span({ display: 'block', color: c.gray500, ...textStyle.caption2 });
const StatValue = styled.strong({
  display: 'block',
  marginTop: 6,
  color: c.gray900,
  fontSize: 26,
  lineHeight: 1.1,
});
const StatHint = styled.span({ display: 'block', marginTop: 7, color: c.gray500, fontSize: 12 });
const FilterPanel = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: 12,
  border: `1px solid ${c.gray200}`,
  borderRadius: 10,
  background: '#FAFBFC',
  '@media (max-width: 760px)': { alignItems: 'flex-start', flexDirection: 'column' },
});
const StatusTabs = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  padding: 3,
  borderRadius: 8,
  background: c.gray100,
});
const StatusTab = styled.button<{ active?: boolean }>(({ active }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  height: 34,
  padding: '0 11px',
  border: 0,
  borderRadius: 6,
  background: active ? c.white : 'transparent',
  color: active ? c.gray900 : c.gray500,
  boxShadow: active ? '0 1px 3px rgba(17,24,39,.12)' : 'none',
  cursor: 'pointer',
  ...textStyle.caption2,
}));
const TabCount = styled.span({
  minWidth: 18,
  padding: '2px 5px',
  borderRadius: 9,
  background: c.gray200,
  color: c.gray700,
  fontSize: 11,
  textAlign: 'center',
});
const ResetButton = styled.button({
  border: 0,
  background: 'transparent',
  color: c.primary,
  cursor: 'pointer',
  ...textStyle.caption2,
});
const TableCard = styled.div({
  overflow: 'hidden',
  border: `1px solid ${c.gray200}`,
  borderRadius: 10,
  background: c.white,
  boxShadow: '0 3px 12px rgba(17,24,39,.04)',
});
const TableToolbar = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 18px',
  borderBottom: `1px solid ${c.gray200}`,
  color: c.gray900,
  ...textStyle.subtitle,
});
const TableMeta = styled.span({ color: c.gray500, ...textStyle.caption2 });
const MailCell = styled.div({ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220 });
const MailIcon = styled.span({
  display: 'grid',
  placeItems: 'center',
  width: 32,
  height: 32,
  borderRadius: 8,
  background: '#EFF6FF',
  color: c.primary,
  fontSize: 16,
});
const MailCopy = styled.div({ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 });
const MailSubject = styled.strong({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: c.gray900,
  ...textStyle.subtitle,
});
const MailCustomer = styled.span({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: c.gray500,
  fontSize: 12,
});
const PreviewCell = styled.span({
  display: 'block',
  maxWidth: 340,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: c.gray500,
  fontSize: 13,
});
const TimeCell = styled.span({ color: c.gray500, whiteSpace: 'nowrap', fontSize: 12 });
const TitleRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
});
const ComposeButton = styled.button({
  border: 0,
  borderRadius: 6,
  padding: '10px 16px',
  background: c.primary,
  color: c.white,
  cursor: 'pointer',
  ...textStyle.subtitle,
});
const ComposeForm = styled.form({
  display: 'grid',
  gap: 10,
  maxWidth: 760,
  padding: 24,
  border: `1px solid ${c.gray200}`,
  borderRadius: 10,
  background: c.white,
});
const ComposeIntro = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  maxWidth: 760,
  padding: '18px 20px',
  borderRadius: 10,
  background: '#EFF6FF',
});
const ComposeIcon = styled.span({
  display: 'grid',
  placeItems: 'center',
  width: 40,
  height: 40,
  borderRadius: 10,
  background: c.white,
  color: c.primary,
  fontSize: 20,
});
const ComposeTitle = styled.strong({ display: 'block', color: c.gray900, ...textStyle.subtitle });
const ComposeHint = styled.span({ display: 'block', marginTop: 4, color: c.gray500, fontSize: 13 });
const Field = styled.label({ display: 'flex', flexDirection: 'column', gap: 7 });
const FieldLabel = styled.span({ color: c.gray700, ...textStyle.caption2 });
const ComposeInput = styled.input({
  padding: '10px 12px',
  border: `1px solid ${c.gray200}`,
  borderRadius: 6,
  ...textStyle.body,
});
const ComposeTextarea = styled.textarea({
  minHeight: 140,
  padding: '10px 12px',
  border: `1px solid ${c.gray200}`,
  borderRadius: 6,
  resize: 'vertical',
  ...textStyle.body,
});
const ComposeFooter = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginTop: 2,
});
const CharacterCount = styled.span({ color: c.gray500, fontSize: 12 });
const Detail = styled.section({
  border: `1px solid ${c.gray200}`,
  borderRadius: 10,
  padding: 24,
  minWidth: 0,
  overflow: 'auto',
});
const ThreadHeader = styled.div({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 20,
  paddingBottom: 20,
  borderBottom: `1px solid ${c.gray200}`,
  '@media (max-width: 700px)': { flexDirection: 'column' },
});
const Eyebrow = styled.span({
  display: 'block',
  marginBottom: 7,
  color: c.primary,
  fontSize: 12,
  fontWeight: 700,
});
const ThreadTitle = styled.h2({ margin: 0, color: c.gray900, ...textStyle.h2_2 });
const CustomerLine = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 9,
  color: c.gray500,
  fontSize: 13,
});
const CopyButton = styled.button({
  padding: 0,
  border: 0,
  background: 'transparent',
  color: c.primary,
  cursor: 'pointer',
  fontSize: 12,
});
const StatusActions = styled.div({
  display: 'flex',
  gap: 4,
  padding: 3,
  borderRadius: 8,
  background: c.gray100,
});
const StatusAction = styled.button<{ active?: boolean }>(({ active }) => ({
  height: 32,
  padding: '0 9px',
  border: 0,
  borderRadius: 6,
  background: active ? c.white : 'transparent',
  color: active ? c.gray900 : c.gray500,
  boxShadow: active ? '0 1px 3px rgba(17,24,39,.12)' : 'none',
  cursor: 'pointer',
  ...textStyle.caption2,
  '&:disabled': { cursor: 'wait', opacity: 0.65 },
}));
const BackButton = styled.button({
  border: `1px solid ${c.gray200}`,
  borderRadius: 6,
  padding: '9px 14px',
  background: c.white,
  color: c.gray900,
  cursor: 'pointer',
  ...textStyle.subtitle,
});
const Timeline = styled.div({ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 });
const Message = styled.article<{ outbound?: boolean }>(({ outbound }) => ({
  alignSelf: outbound ? 'flex-end' : 'flex-start',
  width: 'min(90%, 640px)',
  padding: 14,
  borderRadius: 10,
  background: outbound ? '#EFF6FF' : c.gray50,
}));
const MessageMeta = styled.div({ color: c.gray500, fontSize: 12, marginBottom: 8 });
const MessageBody = styled.div({
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  ...textStyle.body,
});
const AttachmentList = styled.ul({
  margin: '12px 0 0',
  paddingLeft: 18,
  color: c.gray500,
  fontSize: 12,
});
const ReplyBox = styled.div({ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 });
const ReplyButton = styled.button({
  alignSelf: 'flex-end',
  border: 0,
  borderRadius: 6,
  padding: '9px 16px',
  background: c.primary,
  color: c.white,
  ...textStyle.subtitle,
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
});
const Error = styled.p({ margin: 0, color: '#B42318', ...textStyle.caption2 });
