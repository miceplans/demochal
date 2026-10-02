export interface EmailThreadHeaders {
  inReplyTo?: string | null;
  references?: string | null;
  subject?: string | null;
}

/**
 * Returns DB lookup keys in RFC header priority order. Message-ID values are
 * preferred; normalized subject is only a last-resort fallback for messages
 * that do not carry reply headers.
 */
export function threadLookupKeys(headers: EmailThreadHeaders): string[] {
  const keys: string[] = [];
  const add = (value: string | null | undefined) => {
    const normalized = value?.trim();
    if (normalized && !keys.includes(normalized)) keys.push(normalized);
  };

  add(headers.inReplyTo);
  for (const reference of headers.references?.match(/<[^>]+>/g) ?? []) add(reference);
  if (keys.length === 0) {
    const subject = headers.subject
      ?.trim()
      ?.replace(/^(?:(?:re|fwd|fw)\s*:\s*)+/i, '')
      .trim()
      .toLocaleLowerCase();
    add(subject);
  }
  return keys;
}
