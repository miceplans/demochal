import type { AdPlacement } from '@/components/ads/AdPlacementPreview';

const STORAGE_KEY = 'semochal:biz-ad-payment-draft:v1';

export type AdPaymentDraft = {
  placement: AdPlacement;
  imageFileId: string;
  title: string;
  landingUrl?: string;
};

function isDraft(value: unknown): value is AdPaymentDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Record<string, unknown>;
  return (
    (draft.placement === 'hero' || draft.placement === 'gallery') &&
    typeof draft.imageFileId === 'string' &&
    draft.imageFileId.length > 0 &&
    typeof draft.title === 'string' &&
    draft.title.trim().length > 0 &&
    (draft.landingUrl === undefined || typeof draft.landingUrl === 'string')
  );
}

export function readAdPaymentDraft(): AdPaymentDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveAdPaymentDraft(draft: AdPaymentDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage may be unavailable in private browsing; the in-memory draft still works.
  }
}

export function clearAdPaymentDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best effort only.
  }
}
