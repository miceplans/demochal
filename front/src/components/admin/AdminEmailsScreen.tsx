'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  AdminInlineNotice,
  AdminPageTitle,
  Badge,
  ApproveButton,
  FilterBar,
  SearchFilter,
  SelectFilter,
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
type EmailStatus = 'open' | 'pending' | 'resolved';
type EmailStatusRecord = { id?: string; status?: string };

export function updateCachedEmailStatus<T>(
  cached: T | undefined,
  id: string,
  status: EmailStatus,
): T | undefined {
  if (!cached || typeof cached !== 'object') return cached;
  const response = cached as { status?: unknown; data?: unknown };
  if (response.status !== 200) return cached;
  if (Array.isArray(response.data)) {
    return {
      ...response,
      data: response.data.map((row) => {
        if (!row || typeof row !== 'object' || (row as EmailStatusRecord).id !== id) return row;
        return { ...row, status };
      }),
    } as T;
  }
  if (
    response.data &&
    typeof response.data === 'object' &&
    (response.data as EmailStatusRecord).id === id
  ) {
    return { ...response, data: { ...response.data, status } } as T;
  }
  return cached;
}

const READ_KEY = 'admin-emails-read';

/** 스레드를 연 시각을 브라우저에 기록해 읽음 여부를 판단한다(관리자 개인 편의, 서버 저장 없음). */
function readReadMap(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(READ_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}
function markThreadRead(id: string) {
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify({ ...readReadMap(), [id]: Date.now() }));
  } catch {
    // 저장소를 쓸 수 없으면 읽음 표시만 생략한다.
  }
}

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
  return (
    <>
      <FilterBar>
        <SearchFilter
          placeholder="제목 또는 수신자 검색"
          label="제목 또는 수신자 검색"
          value={query}
          onChange={setQuery}
        />
        <ListSummary>최근 200건 기준 · {rows.length}건</ListSummary>
      </FilterBar>
      {list.isPending ? (
        <AdminInlineNotice>발송 내역을 불러오는 중이에요.</AdminInlineNotice>
      ) : null}
      {list.isError ? (
        <AdminInlineNotice role="alert">
          발송 내역을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </AdminInlineNotice>
      ) : null}
      {rows.length ? (
        <MailList role="list">
          {rows.map((row) => (
            <MailItem key={row.id} role="listitem">
              <MailRow as="div">
                <StatusDot tone="done" aria-hidden />
                <Sender>{row.recipient || '-'}</Sender>
                <Summary>
                  <Subject>{row.subject || '(제목 없음)'}</Subject>
                  <TypeTag>
                    {(row.type && automatedTypeLabel[row.type]) || row.type || '알림'}
                  </TypeTag>
                </Summary>
                <Badge tone="green">발송 완료</Badge>
                <TimeCell>{formatTime(row.sentAt ?? undefined)}</TimeCell>
              </MailRow>
            </MailItem>
          ))}
        </MailList>
      ) : null}
    </>
  );
}

const STATUS_FILTERS: { key: '' | EmailStatus; label: string }[] = [
  { key: '', label: '전체' },
  { key: 'open', label: '미처리' },
  { key: 'pending', label: '처리중' },
  { key: 'resolved', label: '완료' },
];

function SupportMailbox() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'' | EmailStatus>('');
  const list = generated.useListAdminEmails({ q: query || undefined, status: status || undefined });
  const overview = generated.useListAdminEmails();
  const rows = list.data?.status === 200 ? list.data.data : [];
  const overviewRows = overview.data?.status === 200 ? overview.data.data : [];
  const counts = useMemo(
    () => ({
      '': overviewRows.length,
      open: overviewRows.filter((row) => row.status === 'open').length,
      pending: overviewRows.filter((row) => row.status === 'pending').length,
      resolved: overviewRows.filter((row) => row.status === 'resolved').length,
    }),
    [overviewRows],
  );
  const tableRows = rows.filter((row): row is typeof row & { id: string } => Boolean(row.id));
  // 목록은 비동기로 채워지므로 초기 렌더에서 localStorage를 읽어도 하이드레이션 불일치가 없다.
  const [readMap] = useState<Record<string, number>>(() =>
    typeof window === 'undefined' ? {} : readReadMap(),
  );
  const isUnread = (row: (typeof tableRows)[number]) => {
    if (row.status !== 'open') return false;
    const readAt = readMap[row.id];
    return !readAt || new Date(row.lastMessageAt ?? 0).getTime() > readAt;
  };

  return (
    <>
      <ToolRow>
        <SearchFilter
          placeholder="제목 또는 고객 이메일 검색"
          label="제목 또는 고객 이메일 검색"
          value={query}
          onChange={setQuery}
        />
        <ChipRow role="group" aria-label="상태 필터">
          {STATUS_FILTERS.map((filter) => (
            <StatusChip
              key={filter.key || 'all'}
              type="button"
              aria-pressed={status === filter.key}
              active={status === filter.key}
              onClick={() => setStatus(filter.key)}
            >
              {filter.label}
              <ChipCount>{counts[filter.key]}</ChipCount>
            </StatusChip>
          ))}
        </ChipRow>
      </ToolRow>
      {list.isPending ? <AdminInlineNotice>메일을 불러오는 중이에요.</AdminInlineNotice> : null}
      {list.isError ? (
        <AdminInlineNotice role="alert">
          메일을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </AdminInlineNotice>
      ) : null}
      {tableRows.length ? (
        <MailList role="list">
          {tableRows.map((row) => (
            <MailItem key={row.id} role="listitem">
              <MailRow
                type="button"
                unread={isUnread(row)}
                onClick={() => router.push(`/admin/emails/${row.id}`)}
              >
                <StatusDot tone={row.status ?? 'open'} aria-hidden />
                <Sender>{row.customerEmail || '고객 주소 없음'}</Sender>
                <Summary>
                  <Subject>{row.subject || '(제목 없음)'}</Subject>
                  <Preview>{row.lastMessage || ''}</Preview>
                </Summary>
                <Badge tone={statusTone[row.status ?? 'open'] ?? 'gray'}>
                  {row.status ? (statusLabel[row.status] ?? row.status) : '미처리'}
                </Badge>
                <TimeCell>{formatTime(row.lastMessageAt)}</TimeCell>
              </MailRow>
            </MailItem>
          ))}
        </MailList>
      ) : null}
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
  const queryClient = useQueryClient();
  const detail = generated.useGetAdminEmail(id, { query: { enabled: true } });
  const reply = generated.useSendAdminEmailReply({
    mutation: {
      // 서버가 답장 시 상태를 처리중으로 바꾸므로 상세·목록을 다시 불러온다.
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: generated.getGetAdminEmailQueryKey(id) });
        void queryClient.invalidateQueries({ queryKey: generated.getListAdminEmailsQueryKey() });
      },
    },
  });
  const statusMutation = generated.useUpdateAdminEmailStatus({
    mutation: {
      onMutate: async ({ id: threadId, data }) => {
        const status = data.status as EmailStatus;
        const detailKey = generated.getGetAdminEmailQueryKey(threadId);
        const listKey = generated.getListAdminEmailsQueryKey();
        await Promise.all([
          queryClient.cancelQueries({ queryKey: detailKey }),
          queryClient.cancelQueries({ queryKey: listKey }),
        ]);
        const previousDetail = queryClient.getQueryData(detailKey);
        const previousLists = queryClient.getQueriesData({ queryKey: listKey });
        queryClient.setQueryData(detailKey, (cached) =>
          updateCachedEmailStatus(cached, threadId, status),
        );
        queryClient.setQueriesData({ queryKey: listKey }, (cached) =>
          updateCachedEmailStatus(cached, threadId, status),
        );
        return { previousDetail, previousLists };
      },
      onError: (_error, variables, context) => {
        const detailKey = generated.getGetAdminEmailQueryKey(variables.id);
        if (context?.previousDetail !== undefined)
          queryClient.setQueryData(detailKey, context.previousDetail);
        context?.previousLists.forEach(([key, value]) => queryClient.setQueryData(key, value));
      },
      onSuccess: (response, variables) => {
        if (response.status !== 200) return;
        const detailKey = generated.getGetAdminEmailQueryKey(variables.id);
        queryClient.setQueryData(detailKey, (cached) =>
          updateCachedEmailStatus(cached, variables.id, response.data.status as EmailStatus),
        );
        queryClient.setQueriesData({ queryKey: generated.getListAdminEmailsQueryKey() }, (cached) =>
          updateCachedEmailStatus(cached, variables.id, response.data.status as EmailStatus),
        );
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: generated.getGetAdminEmailQueryKey(id) });
        void queryClient.invalidateQueries({ queryKey: generated.getListAdminEmailsQueryKey() });
      },
    },
  });
  const selected = detail.data?.status === 200 ? detail.data.data : undefined;
  const loaded = Boolean(selected);
  useEffect(() => {
    if (loaded) markThreadRead(id);
  }, [loaded, id]);
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
            statusChanging={statusMutation.isPending}
            copied={copied}
            onCopyEmail={() => {
              if (!selected.customerEmail) return;
              const write = navigator.clipboard?.writeText;
              if (!write) return;
              void write
                .call(
                  navigator.clipboard,
                  selected.customerEmail.match(/<([^<>\s]+)>/)?.[1] ?? selected.customerEmail,
                )
                .then(() => {
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
            statusError={
              statusMutation.isError
                ? '상태를 변경하지 못했어요. 잠시 후 다시 시도해 주세요.'
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
  toAddresses?: string[];
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

function replySubject(subject?: string | null) {
  return subject?.startsWith('Re:') ? subject : `Re: ${subject ?? '(제목 없음)'}`;
}

function ThreadDetail({
  thread,
  sending,
  onReply,
  onStatusChange,
  statusChanging,
  copied,
  onCopyEmail,
  error,
  statusError,
}: {
  thread: EmailThreadDetail;
  sending: boolean;
  onReply: (text: string) => Promise<boolean>;
  onStatusChange: (status: EmailStatus) => void;
  statusChanging: boolean;
  copied: boolean;
  onCopyEmail: () => void;
  error?: string;
  statusError?: string;
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
          disabled={statusChanging}
          onChange={(value) => onStatusChange(statusValue[value] as EmailStatus)}
        />
        {statusError ? <Error role="alert">{statusError}</Error> : null}
      </ThreadHeader>
      <Timeline>
        {(thread.messages ?? []).map((message) => {
          const outbound = message.direction === 'outbound';
          return (
            <MailCard key={message.id}>
              <MailHead>
                <HeadLabel>보낸 사람</HeadLabel>
                <HeadValue>
                  {outbound ? 'help@semochall.com' : message.fromAddress}
                  <DirectionTag outbound={outbound}>{outbound ? '발신' : '수신'}</DirectionTag>
                </HeadValue>
                {message.toAddresses?.length ? (
                  <>
                    <HeadLabel>받는 사람</HeadLabel>
                    <HeadValue>{message.toAddresses.join(', ')}</HeadValue>
                  </>
                ) : null}
                <HeadLabel>일시</HeadLabel>
                <HeadValue>
                  {new Date(message.sentAt ?? message.receivedAt ?? '').toLocaleString('ko-KR')}
                </HeadValue>
              </MailHead>
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
            </MailCard>
          );
        })}
      </Timeline>
      <ReplyBox aria-label="답장 작성">
        <ReplyField>
          <AdminFieldLabel>받는 사람</AdminFieldLabel>
          <ComposeInput aria-label="받는 사람" readOnly value={thread.customerEmail ?? ''} />
        </ReplyField>
        <ReplyField>
          <AdminFieldLabel>제목</AdminFieldLabel>
          <ComposeInput aria-label="답장 제목" readOnly value={replySubject(thread.subject)} />
        </ReplyField>
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
const ToolRow = styled.div({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 });
const ChipRow = styled.div({ display: 'flex', flexWrap: 'wrap', gap: 8 });
const StatusChip = styled('button', { shouldForwardProp: (prop) => prop !== 'active' })<{
  active: boolean;
}>(({ active }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 14px',
  border: `0.5px solid ${active ? c.primary : c.gray200}`,
  borderRadius: 999,
  background: active ? c.primary : c.white,
  color: active ? c.white : c.gray700,
  cursor: 'pointer',
  ...textStyle.subtitle,
  '&:hover': { background: active ? c.primaryDark : c.gray50 },
}));
const ChipCount = styled.span({ ...textStyle.metaText, color: 'inherit' });
const ListSummary = styled.span({
  alignSelf: 'center',
  marginLeft: 'auto',
  color: c.gray500,
  fontSize: 12,
});
const MailList = styled.ul({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  overflow: 'hidden',
  background: c.white,
});
const MailItem = styled.li({ '& + &': { borderTop: `0.5px solid ${c.gray200}` } });
const MailRow = styled('button', { shouldForwardProp: (prop) => prop !== 'unread' })<{
  unread?: boolean;
}>(({ unread }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  width: '100%',
  padding: '14px 16px',
  border: 0,
  background: unread ? c.white : c.gray50,
  color: c.gray900,
  textAlign: 'left',
  font: 'inherit',
  cursor: 'pointer',
  fontWeight: unread ? 700 : 400,
  transition: 'background-color 160ms ease',
  'div&': { cursor: 'default' },
  '&:hover': { background: c.paleBlue },
  '@media (max-width: 700px)': { flexWrap: 'wrap', gap: 8 },
}));
const dotColor: Record<string, string> = {
  open: c.red,
  pending: c.primary,
  resolved: c.gray300,
  done: c.green,
};
const StatusDot = styled.span<{ tone: string }>(({ tone }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: dotColor[tone] ?? c.gray300,
  flexShrink: 0,
}));
const Sender = styled.span({
  width: 200,
  flexShrink: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 14,
  fontWeight: 'inherit',
  '@media (max-width: 700px)': { width: 'auto', flex: 1 },
});
const Summary = styled.span({
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  flex: 1,
  minWidth: 0,
  '@media (max-width: 700px)': { flexBasis: '100%', order: 3 },
});
const Subject = styled.span({
  flexShrink: 0,
  maxWidth: '55%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 14,
  fontWeight: 'inherit',
});
const Preview = styled.span({
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: c.gray500,
  fontSize: 13,
  fontWeight: 400,
});
const TypeTag = styled.span({ color: c.gray500, fontSize: 12, fontWeight: 400, flexShrink: 0 });
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
  background: c.white,
  padding: 24,
  minWidth: 0,
  overflow: 'auto',
});
const ThreadHeader = styled.div({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 20,
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
const Timeline = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  marginTop: 24,
});
const MailCard = styled.article({
  padding: 20,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  background: c.white,
});
const MailHead = styled.div({
  display: 'grid',
  gridTemplateColumns: 'max-content 1fr',
  gap: '6px 16px',
  marginBottom: 16,
  fontSize: 13,
});
const HeadLabel = styled.span({ color: c.gray500 });
const HeadValue = styled.span({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  color: c.gray900,
  overflowWrap: 'anywhere',
});
const DirectionTag = styled.span<{ outbound?: boolean }>(({ outbound }) => ({
  padding: '1px 8px',
  borderRadius: 999,
  background: outbound ? c.lightBlue : c.gray100,
  color: outbound ? c.primary : c.gray700,
  fontSize: 11,
  fontWeight: 700,
  flexShrink: 0,
}));
const ReplyField = styled.label({ display: 'flex', flexDirection: 'column', gap: 7 });
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
const ReplyBox = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  marginTop: 14,
  padding: 20,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  background: c.white,
});
const ReplyActions = styled.div({ display: 'flex', justifyContent: 'flex-end' });
const Error = styled.p({ margin: 0, color: c.red, ...textStyle.caption2 });
