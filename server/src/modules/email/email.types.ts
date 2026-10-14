export type InboundAttachment = {
  filename: string;
  contentType: string;
  size: number;
};

export type InboundEmail = {
  messageId: string;
  inReplyTo?: string;
  references: string[];
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  sentAt: string;
  attachments?: InboundAttachment[];
};

export const SUPPORT_EMAIL = 'help@semochall.com';

export function normalizeMessageId(value: string): string {
  return value.trim().replace(/^<|>$/g, '').toLowerCase();
}

export function safeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/**
 * RFC 2047 encoded-word(`=?UTF-8?B?...?=`, `=?UTF-8?Q?...?=`)를 사람이 읽을 수 있는 문자열로 푼다.
 * 저장값은 원본 그대로 두고 조회 응답에서만 사용한다(답장 수신자는 원본 주소를 쓴다).
 */
export function decodeMimeWords(value: string | null | undefined): string {
  if (!value) return value ?? '';
  return value
    .replace(/(\?=)\s+(?==\?)/g, '$1')
    .replace(
      /=\?([^?\s]+)\?([bBqQ])\?([^?]*)\?=/g,
      (word, charset: string, enc: string, data: string) => {
        try {
          let bytes: Uint8Array;
          if (enc.toLowerCase() === 'b') {
            bytes = Buffer.from(data, 'base64');
          } else {
            const q = data.replace(/_/g, ' ');
            const out: number[] = [];
            for (let i = 0; i < q.length; i += 1) {
              const hex = q.slice(i + 1, i + 3);
              if (q[i] === '=' && /^[0-9a-fA-F]{2}$/.test(hex)) {
                out.push(parseInt(hex, 16));
                i += 2;
              } else {
                out.push(q.charCodeAt(i));
              }
            }
            bytes = Uint8Array.from(out);
          }
          return new TextDecoder(charset.toLowerCase()).decode(bytes);
        } catch {
          return word;
        }
      },
    );
}

export function resolveThreadId(
  email: Pick<InboundEmail, 'inReplyTo' | 'references'>,
  messages: { messageId: string | null; threadId: string }[],
): string | undefined {
  const headers = [email.inReplyTo, ...email.references]
    .filter(Boolean)
    .map((value) => normalizeMessageId(value!));
  const linked = messages.find((message) =>
    headers.includes(normalizeMessageId(message.messageId ?? '')),
  );
  if (linked) return linked.threadId;
}
