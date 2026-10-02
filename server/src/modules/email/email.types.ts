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
