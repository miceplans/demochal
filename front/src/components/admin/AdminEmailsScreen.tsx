'use client';

import { useState } from 'react';
import styled from '@emotion/styled';
import { adminEmailApi } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  AdminInlineNotice,
  AdminPageTitle,
  Badge,
  FilterBar,
  SearchFilter,
  SelectFilter,
} from './parts';

const statusLabel: Record<string, string> = { open: '미처리', pending: '처리중', resolved: '완료' };
const statusValue: Record<string, string> = { 미처리: 'open', 처리중: 'pending', 완료: 'resolved' };

export function AdminEmailsScreen() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const params = {
    q: query || undefined,
    status: statusValue[status] as 'open' | 'pending' | 'resolved' | undefined,
  };
  const list = adminEmailApi.useListAdminEmails(params);
  const rows = list.data?.status === 200 ? list.data.data : [];
  const detail = adminEmailApi.useGetAdminEmail(selectedId ?? '', { enabled: Boolean(selectedId) });
  const reply = adminEmailApi.useSendAdminEmailReply();
  const selected = detail.data?.status === 200 ? detail.data.data : undefined;

  return (
    <Screen>
      <AdminPageTitle>메일함</AdminPageTitle>
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
      {!list.isPending && !list.isError && rows.length === 0 ? (
        <AdminInlineNotice>표시할 메일이 없어요.</AdminInlineNotice>
      ) : null}
      <Content>
        <ThreadList aria-label="메일 thread 목록">
          {rows.map((row) => (
            <ThreadRow
              key={row.id}
              selected={row.id === selectedId}
              onClick={() => setSelectedId(row.id)}
              type="button"
            >
              <RowTop>
                <strong>{row.subject || '(제목 없음)'}</strong>
                <Badge>{row.status ? (statusLabel[row.status] ?? row.status) : '미처리'}</Badge>
              </RowTop>
              <small>{row.customerEmail}</small>
              <Preview>{row.lastMessage || '(본문 없음)'}</Preview>
              <Time>
                {row.lastMessageAt ? new Date(row.lastMessageAt).toLocaleString('ko-KR') : ''}
              </Time>
            </ThreadRow>
          ))}
        </ThreadList>
        <Detail>
          {!selectedId ? (
            <AdminInlineNotice>메일을 선택하면 대화 내용이 보여요.</AdminInlineNotice>
          ) : null}
          {selectedId && detail.isPending ? (
            <AdminInlineNotice>대화를 불러오는 중이에요.</AdminInlineNotice>
          ) : null}
          {selected ? (
            <ThreadDetail
              thread={selected}
              sending={reply.isPending}
              onReply={async (text) => {
                try {
                  await reply.mutateAsync({ id: selected.id ?? '', data: { text } });
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
      </Content>
    </Screen>
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
const Content = styled.div({
  display: 'grid',
  gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
  gap: 20,
  minHeight: 560,
});
const ThreadList = styled.div({
  border: `1px solid ${c.gray200}`,
  borderRadius: 10,
  overflow: 'auto',
  background: c.white,
});
const ThreadRow = styled.button<{ selected?: boolean }>(({ selected }) => ({
  display: 'block',
  width: '100%',
  padding: 16,
  textAlign: 'left',
  border: 0,
  borderBottom: `1px solid ${c.gray200}`,
  background: selected ? '#EFF6FF' : c.white,
  cursor: 'pointer',
  '&:hover': { background: '#F8FAFC' },
}));
const RowTop = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'center',
  ...textStyle.subtitle,
});
const Preview = styled.p({
  margin: '8px 0 4px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: c.gray500,
  ...textStyle.caption2,
});
const Time = styled.span({ color: c.gray500, fontSize: 11 });
const Detail = styled.section({
  border: `1px solid ${c.gray200}`,
  borderRadius: 10,
  padding: 24,
  minWidth: 0,
  overflow: 'auto',
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
