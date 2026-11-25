import { useEffect } from 'react';

// 폼 초안은 'semochal:form-draft:v1:<key>' 키로 localStorage에 저장한다.
// 값은 { value, savedAt } 봉투로 감싸 TTL(7일)이 지난 초안은 복원하지 않는다.
const PREFIX = 'semochal:form-draft:v1:';
export const FORM_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function readFormDraft<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const envelope = parsed as Record<string, unknown>;
    if (typeof envelope.savedAt !== 'number' || Date.now() - envelope.savedAt > FORM_DRAFT_TTL_MS) {
      window.localStorage.removeItem(PREFIX + key);
      return null;
    }
    return isValid(envelope.value) ? (envelope.value as T) : null;
  } catch {
    return null;
  }
}

export function writeFormDraft(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ value, savedAt: Date.now() }));
  } catch {
    // 저장소 불가(프라이빗 모드·용량 초과) 시 조용히 무시한다 — 폼 동작을 막지 않는다.
  }
}

export function clearFormDraft(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Best effort only.
  }
}

function sameDraftValue(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * 폼 값이 바뀔 때마다 초안을 디바운스 저장한다.
 * baseline(서버에서 불러온 초기값 등)과 같아지면 초안을 지워, 수정 폼에서 손대지 않은
 * 값이 오래된 초안으로 덮이는 일을 막는다.
 */
export function useFormDraftSaver(
  key: string,
  value: unknown,
  options?: { baseline?: unknown; debounceMs?: number },
): void {
  const baseline = options?.baseline;
  const debounceMs = options?.debounceMs ?? 500;
  useEffect(() => {
    const timer = setTimeout(() => {
      if (baseline !== undefined && sameDraftValue(value, baseline)) clearFormDraft(key);
      else writeFormDraft(key, value);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [key, value, baseline, debounceMs]);
}
