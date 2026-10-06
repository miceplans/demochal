export const SUPPORT_EMAIL_EVENT = 'support.email';

export interface SupportEmailJobMessage {
  eventId: string;
  payload: { messageId: string };
}

export function parseSupportEmailJob(raw: unknown): SupportEmailJobMessage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { eventId, payload } = raw as { eventId?: unknown; payload?: unknown };
  if (typeof eventId !== 'string' || typeof payload !== 'object' || payload === null) return null;
  const { messageId } = payload as { messageId?: unknown };
  return typeof messageId === 'string' ? { eventId, payload: { messageId } } : null;
}
