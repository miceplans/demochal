export type InboundAttachment = {
  filename: string;
  contentType: string;
  size: number;
  storageKey?: string;
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

export function normalizeSubject(value: string): string {
  return value
    .trim()
    .replace(/^(fwd|fw|re)\s*:\s*/gi, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('ko-KR');
}

export function safeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export function resolveThreadId(
  email: Pick<InboundEmail, 'inReplyTo' | 'references' | 'subject'>,
  messages: { messageId: string | null; threadId: string }[],
  threads: { id: string; subject: string | null }[],
): string | undefined {
  const headers = [email.inReplyTo, ...email.references]
    .filter(Boolean)
    .map((value) => normalizeMessageId(value!));
  const linked = messages.find((message) =>
    headers.includes(normalizeMessageId(message.messageId ?? '')),
  );
  if (linked) return linked.threadId;
  return threads.find(
    (thread) => normalizeSubject(thread.subject ?? '') === normalizeSubject(email.subject),
  )?.id;
}

export function buildRawReply(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  inReplyTo: string;
  references: string[];
  messageId: string;
}): string {
  const boundary = `=_semochal_${input.messageId.replace(/[^a-z0-9]/gi, '')}`;
  const headers = [
    `From: ${SUPPORT_EMAIL}`,
    `To: ${safeHeader(input.to)}`,
    `Subject: ${safeHeader(input.subject)}`,
    `Message-ID: <${safeHeader(input.messageId).replace(/^<|>$/g, '')}>`,
    `In-Reply-To: <${safeHeader(input.inReplyTo).replace(/^<|>$/g, '')}>`,
    `References: ${input.references.map((value) => `<${safeHeader(value).replace(/^<|>$/g, '')}>`).join(' ')}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const html =
    input.html ||
    `<pre>${input.text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]!)}</pre>`;
  return [
    ...headers,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    input.text,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    `--${boundary}--`,
    '',
  ].join('\r\n');
}
