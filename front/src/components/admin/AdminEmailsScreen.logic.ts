type Mailbox = 'support' | 'noreply';
type EmailStatus = 'open' | 'pending' | 'resolved';
type EmailStatusRecord = { id?: string; status?: string };

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

function replySubject(subject?: string | null) {
  return subject?.startsWith('Re:') ? subject : `Re: ${subject ?? '(제목 없음)'}`;
}

export type { EmailMessage, EmailStatus, EmailThreadDetail, Mailbox };
export { formatTime, markThreadRead, readReadMap, replySubject };
