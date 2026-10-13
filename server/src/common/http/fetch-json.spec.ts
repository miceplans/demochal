import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, urlForLog } from './fetch-json.js';

describe('urlForLog', () => {
  describe('urlForLog', () => {
    it('keeps only origin and pathname so query-string secrets cannot land in logs', () => {
      expect(
        urlForLog(
          'https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=SECRET&returnType=JSON',
        ),
      ).toBe('https://api.odcloud.kr/api/nts-businessman/v1/status');
    });

    it('passes through urls without a query string unchanged', () => {
      expect(urlForLog('https://api.tosspayments.com/v1/payments/confirm')).toBe(
        'https://api.tosspayments.com/v1/payments/confirm',
      );
    });

    it('returns a placeholder for unparseable input', () => {
      expect(urlForLog('not a url')).toBe('(unparseable-url)');
    });
  });

  describe('fetchJson', () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('applies a default timeout signal when the caller passes none', async () => {
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response);
      const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});

      await fetchJson('https://example.com/x');
      const init = fetchMock.mock.calls[0]![1];
      // AbortSignal.timeout(10_000) — 정확한 시각 의미는 Node 구현에 맡기고,
      // 호출자 신호 없이 타임아웃 신호가 연결됐는지만 본다.
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.signal?.aborted).toBe(false);
      expect(debug).toHaveBeenCalledWith('GET https://example.com/x');
    });

    it('attaches its own timeout signal for a per-call timeoutMs override', async () => {
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response);

      await fetchJson('https://example.com/x', { timeoutMs: 2_000 });
      const init = fetchMock.mock.calls[0]![1];
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.signal?.aborted).toBe(false);
    });

    it('keeps the caller-provided signal instead of the default timeout', async () => {
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response);
      const controller = new AbortController();

      await fetchJson('https://example.com/x', { signal: controller.signal });
      expect(fetchMock.mock.calls[0]![1]?.signal).toBe(controller.signal);

      controller.abort();
      expect(fetchMock.mock.calls[0]![1]?.signal?.aborted).toBe(true);
    });

    it('logs only the redacted url even when the request url carries a secret query', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);
      const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});

      await fetchJson('https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=SECRET', {
        method: 'POST',
      });

      const logged = debug.mock.calls[0]![0] as string;
      expect(logged).toBe('POST https://api.odcloud.kr/api/nts-businessman/v1/status');
      expect(logged).not.toContain('SECRET');
      expect(logged).not.toContain('serviceKey');
    });
  });
});
