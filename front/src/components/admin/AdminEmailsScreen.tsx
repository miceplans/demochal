'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  type AdminColumn,
  AdminInlineNotice,
  AdminTable,
  AdminPageTitle,
  Badge,
  ApproveButton,
  FilterBar,
  RejectButton,
  SearchFilter,
  SelectFilter,
  StatCard,
  StatRow,
  FieldLabel as AdminFieldLabel,
} from './parts';

type Mailbox = 'support' | 'noreply';
const MAILBOXES: { key: Mailbox; label: string; address: string }[] = [
  { key: 'support', label: '고객지원', address: 'help@semochall.com' },
  { key: 'noreply', label: '자동 발송', address: 'no-reply@semochall.com' },
];
const statusTone: Record<string, 'red' | 'blue' | 'green'> = {
  open: 'red',
  pending: 'blue',
  resolved: 'green',
};
const automatedTypeLabel: Record<string, string> = {
  'verification.result': '인증 결과',
  team_matching: '팀 매칭',
};
const statusLabel: Record<string, string> = { open: '미처리', pending: '처리중', resolved: '완료' };
const statusValue: Record<string, string> = { 미처리: 'open', 처리중: 'pending', 완료: 'resolved' };
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
  const [mailbox, setMailbox] = useState<Mailbox>('support');
  return (
    <Screen>
      <TitleRow>
        <AdminPageTitle>메일함</AdminPageTitle>
        {mailbox === 'support' ? (
          <ApproveButton type="button" onClick={() => router.push('/admin/emails/compose')}>
            + 새 메일
          </ApproveButton>
        ) : null}
      </TitleRow>
      <MailboxTabs role="tablist" aria-label="메일함 구분">
        {MAILBOXES.map((box) => (
          <MailboxTab
            key={box.key}
            type="button"
            role="tab"
            id={`mailbox-tab-${box.key}`}
            aria-selected={mailbox === box.key}
            aria-controls="mailbox-panel"
            active={mailbox === box.key}
            onClick={() => setMailbox(box.key)}
          >
            {box.label}
            <TabAddress>{box.address}</TabAddress>
          </MailboxTab>
        ))}
      </MailboxTabs>
      <Panel role="tabpanel" id="mailbox-panel" aria-labelledby={`mailbox-tab-${mailbox}`}>
        {mailbox === 'support' ? <SupportMailbox /> : <AutomatedMailbox />}
      </Panel>
    </Screen>
  );
}

function AutomatedMailbox() {
  const [query, setQuery] = useState('');
  const list = generated.useListAdminAutomatedEmails({ q: query || undefined });
  const rows = (list.data?.status === 200 ? list.data.data : []).filter(
    (row): row is typeof row & { id: string } => Boolean(row.id),
  );
  const columns: AdminColumn<(typeof rows)[number]>[] = [
    {
      key: 'subject',
      header: '메일',
      render: (row) => (
        <MailCell>
          <MailIcon aria-hidden>✉</MailIcon>
          <MailCopy>
            <MailSubject>{row.subject || '(제목 없음)'}</MailSubject>
            <MailCustomer>
              {(row.type && automatedTypeLabel[row.type]) || row.type || '알림'}
            </MailCustomer>
          </MailCopy>
        </MailCell>
      ),
    },
    { key: 'recipient', header: '수신자', render: (row) => row.recipient || '-' },
    {
      key: 'sentAt',
      header: '발송 시각',
      render: (row) => <TimeCell>{formatTime(row.sentAt ?? undefined)}</TimeCell>,
    },
    { key: 'status', header: '상태', render: () => <Badge tone="green">발송 완료</Badge> },
  ];
  return (
    <>
      <StatRow>
        <StatCard
          label="최근 발송"
          value={String(rows.length)}
          meta="최근 200건 기준 자동 발송"
          dot={c.green}
        />
      </StatRow>
      <FilterBar>
        <SearchFilter
          placeholder="제목 또는 수신자 검색"
          label="제목 또는 수신자 검색"
          value={query}
          onChange={setQuery}
        />
        {query ? (
          <RejectButton type="button" onClick={() => setQuery('')}>
            필터 초기화
          </RejectButton>
        ) : null}
      </FilterBar>
      {list.isPending ? (
        <AdminInlineNotice>발송 내역을 불러오는 중이에요.</AdminInlineNotice>
      ) : null}
      {list.isError ? (
        <AdminInlineNotice role="alert">
          발송 내역을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </AdminInlineNotice>
      ) : null}
      {list.isSuccess && rows.length === 0 ? (
        <AdminInlineNotice>자동 발송된 메일이 없어요.</AdminInlineNotice>
      ) : null}
      <AdminTable columns={columns} rows={rows} />
    </>
  );
}

function SupportMailbox() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const params = {
    q: query || undefined,
    status: statusValue[status] as 'open' | 'pending' | 'resolved' | undefined,
  };
  const list = generated.useListAdminEmails(params);
  const overview = generated.useListAdminEmails();
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
        <Badge tone={statusTone[row.status ?? 'open'] ?? 'gray'}>
          {row.status ? (statusLabel[row.status] ?? row.status) : '미처리'}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <StatRow>
        <StatCard label="전체 메일" value={String(counts.total)} meta="전체 고객 문의" />
        <StatCard
          label="미처리"
          value={String(counts.open)}
          meta="확인이 필요한 메일"
          dot={c.red}
        />
        <StatCard
          label="처리중"
          value={String(counts.pending)}
          meta="답변 진행 중"
          dot={c.primary}
        />
        <StatCard
          label="완료"
          value={String(counts.resolved)}
          meta="처리 완료된 메일"
          dot={c.green}
        />
      </StatRow>
      <FilterBar>
        <SearchFilter
          placeholder="제목 또는 고객 이메일 검색"
          label="제목 또는 고객 이메일 검색"
          value={query}
          onChange={setQuery}
        />
        <SelectFilter
          label="상태"
          options={['미처리', '처리중', '완료']}
          value={status}
          onChange={setStatus}
        />
        {query || status ? (
          <RejectButton
            type="button"
            onClick={() => {
              setQuery('');
              setStatus('');
            }}
          >
            필터 초기화
          </RejectButton>
        ) : null}
      </FilterBar>
      {list.isPending ? <AdminInlineNotice>메일을 불러오는 중이에요.</AdminInlineNotice> : null}
      {list.isError ? (
        <AdminInlineNotice role="alert">
          메일을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </AdminInlineNotice>
      ) : null}
      <AdminTable
        columns={columns}
        rows={tableRows}
        onRowClick={(row) => router.push(`/admin/emails/${row.id}`)}
      />
    </>
  );
}

export function AdminEmailComposeScreen() {
  const router = useRouter();
  const compose = generated.useCreateAdminEmail();
  return (
    <Screen>
      <TitleRow>
        <PageHeadingWithBack>
          <BackGlyph
            type="button"
            aria-label="메일함으로 돌아가기"
            onClick={() => router.push('/admin/emails')}
          >
            ‹
          </BackGlyph>
          <AdminPageTitle>새 메일 작성</AdminPageTitle>
        </PageHeadingWithBack>
      </TitleRow>
      <ComposePanel
        sending={compose.isPending}
        error={
          compose.isError
            ? '메일 발송에 실패했어요. 입력한 내용으로 다시 시도해 주세요.'
            : undefined
        }
        onSend={async (data) => {
          try {
            await compose.mutateAsync({ data });
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
  const detail = generated.useGetAdminEmail(id, { query: { enabled: true } });
  const reply = generated.useSendAdminEmailReply();
  const statusMutation = generated.useUpdateAdminEmailStatus();
  const selected = detail.data?.status === 200 ? detail.data.data : undefined;
  const [copied, setCopied] = useState(false);
  return (
    <Screen>
      <TitleRow>
        <PageHeadingWithBack>
          <BackGlyph
            type="button"
            aria-label="메일함으로 돌아가기"
            onClick={() => router.push('/admin/emails')}
          >
            ‹
          </BackGlyph>
          <AdminPageTitle>메일 보기</AdminPageTitle>
        </PageHeadingWithBack>
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
            onStatusChange={(status) => statusMutation.mutate({ id, data: { status } })}
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
        <AdminFieldLabel>받는 사람</AdminFieldLabel>
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
        <AdminFieldLabel>제목</AdminFieldLabel>
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
        <ApproveButton
          type="submit"
          disabled={sending || !to.trim() || !subject.trim() || !text.trim()}
        >
          {sending ? '발송 중…' : '메일 보내기'}
        </ApproveButton>
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
  onStatusChange,
  copied,
  onCopyEmail,
  error,
}: {
  thread: EmailThreadDetail;
  sending: boolean;
  onReply: (text: string) => Promise<boolean>;
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
          <Eyebrow>고객지원 · help@semochall.com</Eyebrow>
          <ThreadTitle>{thread.subject || '(제목 없음)'}</ThreadTitle>
          <CustomerLine>
            {thread.customerEmail || '고객 이메일 없음'}{' '}
            <CopyButton type="button" onClick={onCopyEmail}>
              {copied ? '복사됨' : '이메일 복사'}
            </CopyButton>
          </CustomerLine>
        </div>
        <SelectFilter
          label="상태"
          options={['미처리', '처리중', '완료']}
          value={statusLabel[thread.status ?? ''] ?? ''}
          onChange={(value) =>
            onStatusChange(statusValue[value] as 'open' | 'pending' | 'resolved')
          }
        />
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
        <ComposeTextarea
          aria-label="답장 내용"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="답장 내용을 입력하세요."
          maxLength={100000}
        />
        {error ? <Error role="alert">{error}</Error> : null}
        <ReplyActions>
          <ApproveButton
            type="button"
            disabled={sending || !text.trim()}
            onClick={() => {
              void onReply(text).then((success) => {
                if (success) setText('');
              });
            }}
          >
            {sending ? '발송 중…' : '답장 보내기'}
          </ApproveButton>
        </ReplyActions>
      </ReplyBox>
    </>
  );
}

const Screen = styled.div({ display: 'flex', flexDirection: 'column', gap: 24, minHeight: 0 });
const MailboxTabs = styled.div({
  display: 'flex',
  gap: 24,
  borderBottom: `0.5px solid ${c.gray200}`,
});
const MailboxTab = styled('button', { shouldForwardProp: (prop) => prop !== 'active' })<{
  active: boolean;
}>(({ active }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  marginBottom: -0.5,
  padding: '10px 4px',
  border: 0,
  borderBottom: `2px solid ${active ? c.primary : 'transparent'}`,
  background: 'transparent',
  color: active ? c.primary : c.gray500,
  cursor: 'pointer',
  ...textStyle.subtitle,
}));
const TabAddress = styled.span({ ...textStyle.metaText, color: c.gray500 });
const Panel = styled.div({ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 });
const PageHeadingWithBack = styled.div({ display: 'flex', alignItems: 'center', gap: 8 });
const BackGlyph = styled.button({
  border: 0,
  padding: 0,
  background: 'transparent',
  color: c.gray700,
  cursor: 'pointer',
  fontSize: 28,
  lineHeight: 1,
});
const MailCell = styled.div({ display: 'flex', alignItems: 'center', gap: 10, minWidth: 220 });
const MailIcon = styled.span({
  display: 'grid',
  placeItems: 'center',
  width: 32,
  height: 32,
  borderRadius: 4,
  background: c.lightBlue,
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
const ComposeForm = styled.form({
  display: 'grid',
  gap: 10,
  maxWidth: 760,
  padding: 24,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  background: c.white,
});
const Field = styled.label({ display: 'flex', flexDirection: 'column', gap: 7 });
const ComposeInput = styled.input({
  padding: '10px 12px',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 10,
  outline: 'none',
  ...textStyle.body,
  '&:focus': { borderColor: c.primary },
});
const ComposeTextarea = styled.textarea({
  minHeight: 140,
  padding: '10px 12px',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 10,
  outline: 'none',
  resize: 'vertical',
  ...textStyle.body,
  '&:focus': { borderColor: c.primary },
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
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
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
  borderBottom: `0.5px solid ${c.gray200}`,
  '@media (max-width: 700px)': { flexDirection: 'column' },
});
const Eyebrow = styled.span({
  display: 'block',
  marginBottom: 7,
  color: c.primary,
  fontSize: 12,
  fontWeight: 700,
});
const ThreadTitle = styled.h2({ margin: 0, color: c.gray900, ...textStyle.h3_2 });
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
const Timeline = styled.div({ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 });
const Message = styled.article<{ outbound?: boolean }>(({ outbound }) => ({
  alignSelf: outbound ? 'flex-end' : 'flex-start',
  width: 'min(90%, 640px)',
  padding: 14,
  borderRadius: 8,
  background: outbound ? c.lightBlue : c.gray50,
}));
const MessageMeta = styled.div({ color: c.gray500, fontSize: 12, marginBottom: 8 });
const MessageBody = styled.div({
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  ...textStyle.bodySmall,
});
const AttachmentList = styled.ul({
  margin: '12px 0 0',
  paddingLeft: 18,
  color: c.gray500,
  fontSize: 12,
});
const ReplyBox = styled.div({ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 });
const ReplyActions = styled.div({ display: 'flex', justifyContent: 'flex-end' });
const Error = styled.p({ margin: 0, color: c.red, ...textStyle.caption2 });
