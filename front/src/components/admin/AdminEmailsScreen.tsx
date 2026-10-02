'use client';

import { useState } from 'react';
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
  SelectFilter,
} from './parts';

const statusLabel: Record<string, string> = { open: '미처리', pending: '처리중', resolved: '완료' };
const statusValue: Record<string, string> = { 미처리: 'open', 처리중: 'pending', 완료: 'resolved' };

export function AdminEmailsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const params = {
    q: query || undefined,
    status: statusValue[status] as 'open' | 'pending' | 'resolved' | undefined,
  };
  const list = adminEmailApi.useListAdminEmails(params);
  const rows = list.data?.status === 200 ? list.data.data : [];
  const tableRows = rows.filter((row): row is typeof row & { id: string } => Boolean(row.id));
  const columns: AdminColumn<(typeof tableRows)[number]>[] = [
    { key: 'subject', header: '제목', render: (row) => row.subject || '(제목 없음)' },
    { key: 'customerEmail', header: '고객 이메일', render: (row) => row.customerEmail || '-' },
    { key: 'lastMessage', header: '마지막 메시지', render: (row) => row.lastMessage || '-' },
    {
      key: 'lastMessageAt',
      header: '최근 시각',
      render: (row) =>
        row.lastMessageAt ? new Date(row.lastMessageAt).toLocaleString('ko-KR') : '-',
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
        <AdminPageTitle>메일함</AdminPageTitle>
        <ComposeButton type="button" onClick={() => router.push('/admin/emails/compose')}>
          새 메일 작성
        </ComposeButton>
      </TitleRow>
      <FilterBar>
        <SearchFilter
          placeholder="제목/고객 이메일 검색"
          label="제목/고객 이메일 검색"
          value={query}
          onChange={setQuery}
        />
        <SelectFilter
          label="상태"
          options={['미처리', '처리중', '완료']}
          value={status}
          onChange={setStatus}
        />
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
  const selected = detail.data?.status === 200 ? detail.data.data : undefined;
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
      <ComposeInput
        type="email"
        required
        placeholder="받는 사람 이메일"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      />
      <ComposeInput
        required
        placeholder="제목"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <ComposeTextarea
        required
        placeholder="메일 내용을 입력하세요."
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={100000}
      />
      {error ? <Error role="alert">{error}</Error> : null}
      <ReplyButton
        type="submit"
        disabled={sending || !to.trim() || !subject.trim() || !text.trim()}
      >
        {sending ? '발송 중…' : '메일 보내기'}
      </ReplyButton>
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
  messages?: EmailMessage[];
};

function ThreadDetail({
  thread,
  sending,
  onReply,
  error,
}: {
  thread: EmailThreadDetail;
  sending: boolean;
  onReply: (text: string) => Promise<boolean>;
  error?: string;
}) {
  const [text, setText] = useState('');
  return (
    <>
      <h2>{thread.subject || '(제목 없음)'}</h2>
      <small>{thread.customerEmail}</small>
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
  padding: 18,
  border: `1px solid ${c.gray200}`,
  borderRadius: 10,
  background: c.white,
});
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
const Detail = styled.section({
  border: `1px solid ${c.gray200}`,
  borderRadius: 10,
  padding: 24,
  minWidth: 0,
  overflow: 'auto',
});
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
