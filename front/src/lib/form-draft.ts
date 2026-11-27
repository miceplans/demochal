import { useEffect } from 'react';

// 폼 초안은 'semochal:form-draft:v1:<key>' 키로 브라우저 저장소에 저장한다.
// 값은 { value, savedAt } 봉투로 감싸 TTL(7일)이 지난 초안은 복원하지 않는다.
// 저장소는 기본 localStorage이고, 개인정보가 들어갈 수 있는 초안(지원서 답변 등)은
// `storage: 'session'`으로 sessionStorage(탭을 닫으면 사라짐)에 둔다.
// 로그아웃·계정 전환 시 clearAllFormDrafts()가 두 저장소의 초안을 모두 지운다.
const PREFIX = 'semochal:form-draft:v1:';
export const FORM_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type FormDraftOptions = { storage?: 'local' | 'session' };

function draftStorage(options?: FormDraftOptions): Storage {
  return options?.storage === 'session' ? window.sessionStorage : window.localStorage;
}

export function readFormDraft<T>(
  key: string,
  isValid: (value: unknown) => value is T,
  options?: FormDraftOptions,
): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const storage = draftStorage(options);
    // sessionStorage로 옮긴 초안이 예전 버전에서 localStorage에 남아 있으면 지운다.
    if (options?.storage === 'session') window.localStorage.removeItem(PREFIX + key);
    const raw = storage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const envelope = parsed as Record<string, unknown>;
    if (typeof envelope.savedAt !== 'number' || Date.now() - envelope.savedAt > FORM_DRAFT_TTL_MS) {
      storage.removeItem(PREFIX + key);
      return null;
    }
    return isValid(envelope.value) ? (envelope.value as T) : null;
  } catch {
    return null;
  }
}

export function writeFormDraft(key: string, value: unknown, options?: FormDraftOptions): void {
  if (typeof window === 'undefined') return;
  try {
    draftStorage(options).setItem(PREFIX + key, JSON.stringify({ value, savedAt: Date.now() }));
  } catch {
    // 저장소 불가(프라이빗 모드·용량 초과) 시 조용히 무시한다 — 폼 동작을 막지 않는다.
  }
}

export function clearFormDraft(key: string, options?: FormDraftOptions): void {
  if (typeof window === 'undefined') return;
  try {
    draftStorage(options).removeItem(PREFIX + key);
  } catch {
    // Best effort only.
  }
}

/** 두 저장소에 남은 모든 폼 초안을 지운다(로그아웃·계정 전환 시 다음 사용자에게 남지 않게). */
export function clearAllFormDrafts(): void {
  if (typeof window === 'undefined') return;
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key?.startsWith(PREFIX)) keys.push(key);
      }
      keys.forEach((key) => storage.removeItem(key));
    } catch {
      // Best effort only.
    }
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
  options?: { baseline?: unknown; debounceMs?: number } & FormDraftOptions,
): void {
  const baseline = options?.baseline;
  const debounceMs = options?.debounceMs ?? 500;
  const storage = options?.storage;
  useEffect(() => {
    const timer = setTimeout(() => {
      if (baseline !== undefined && sameDraftValue(value, baseline))
        clearFormDraft(key, { storage });
      else writeFormDraft(key, value, { storage });
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [key, value, baseline, debounceMs, storage]);
}
