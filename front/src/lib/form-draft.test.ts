import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  FORM_DRAFT_TTL_MS,
  clearFormDraft,
  readFormDraft,
  useFormDraftSaver,
  writeFormDraft,
} from './form-draft';

const isString = (value: unknown): value is string => typeof value === 'string';

describe('form draft storage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('stores and restores a draft value', () => {
    writeFormDraft('posting:new', { title: '공고' });

    expect(
      readFormDraft('posting:new', (v): v is { title: string } => typeof v === 'object'),
    ).toEqual({ title: '공고' });
  });

  it('namespaces keys so drafts do not collide', () => {
    writeFormDraft('a', 'one');
    writeFormDraft('b', 'two');

    expect(readFormDraft('a', isString)).toBe('one');
    expect(readFormDraft('b', isString)).toBe('two');
  });

  it('ignores malformed JSON', () => {
    localStorage.setItem('semochal:form-draft:v1:bad', '{not json');

    expect(readFormDraft('bad', isString)).toBeNull();
  });

  it('rejects values failing the validator', () => {
    writeFormDraft('num', 42);

    expect(readFormDraft('num', isString)).toBeNull();
  });

  it('expires drafts older than the TTL', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      writeFormDraft('old', 'stale');
      vi.setSystemTime(new Date(Date.now() + FORM_DRAFT_TTL_MS + 1));

      expect(readFormDraft('old', isString)).toBeNull();
      expect(localStorage.getItem('semochal:form-draft:v1:old')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears a draft', () => {
    writeFormDraft('done', 'value');
    clearFormDraft('done');

    expect(readFormDraft('done', isString)).toBeNull();
  });

  it('swallows storage failures instead of breaking the form', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    try {
      expect(() => writeFormDraft('x', 'y')).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('useFormDraftSaver', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  const isObj = (v: unknown): v is { title: string } =>
    !!v && typeof v === 'object' && typeof (v as { title?: unknown }).title === 'string';

  it('saves the value after the debounce', () => {
    renderHook(({ value }) => useFormDraftSaver('hook', value, { debounceMs: 100 }), {
      initialProps: { value: { title: '입력' } },
    });
    vi.advanceTimersByTime(150);

    expect(readFormDraft('hook', isObj)).toEqual({ title: '입력' });
  });

  it('debounces rapid changes into one write', () => {
    const { rerender } = renderHook(
      ({ value }) => useFormDraftSaver('hook', value, { debounceMs: 100 }),
      { initialProps: { value: { title: 'a' } } },
    );
    rerender({ value: { title: 'ab' } });
    rerender({ value: { title: 'abc' } });
    vi.advanceTimersByTime(150);

    expect(readFormDraft('hook', isObj)).toEqual({ title: 'abc' });
  });

  it('clears the draft when the value returns to the baseline', () => {
    writeFormDraft('hook', { title: '변경됨' });
    renderHook(
      ({ value }) => useFormDraftSaver('hook', value, { baseline: { title: '' }, debounceMs: 100 }),
      { initialProps: { value: { title: '' } } },
    );
    vi.advanceTimersByTime(150);

    expect(readFormDraft('hook', isObj)).toBeNull();
  });
});
