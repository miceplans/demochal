import { Injectable } from '@nestjs/common';
import { fetchJson } from '../../../common/http/fetch-json.js';
import { env } from '../../../config/env.js';

export interface OcrResult {
  businessName?: string;
  registrationNumber?: string;
  raw: Record<string, unknown>;
}

@Injectable()
export class ClovaOcrClient {
  isConfigured(): boolean {
    return Boolean(env.clovaOcrApiUrl && env.clovaOcrSecretKey);
  }

  async recognizeBusinessLicense(fileUrl: string): Promise<OcrResult> {
    if (!this.isConfigured()) {
      throw new Error('CLOVA_OCR_API_URL / CLOVA_OCR_SECRET_KEY is not configured');
    }
    const fileName = new URL(fileUrl).pathname.split('/').pop() || 'business-license';
    const extension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const response = await fetchJson(env.clovaOcrApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-OCR-SECRET': env.clovaOcrSecretKey },
      body: JSON.stringify({
        version: 'V2',
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
        images: [{ format: extension, name: fileName, url: fileUrl }],
      }),
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, any>;
    const image = body.images?.[0];
    if (!response.ok || !image || image.inferResult !== 'SUCCESS') {
      throw new Error(image?.message || 'Unable to recognize business license');
    }
    const raw = (image.businessLicense?.result ?? {}) as Record<string, unknown>;
    const text = JSON.stringify(raw);
    const registrationNumber =
      readText(raw.businessNumber) ??
      readText(raw.registrationNumber) ??
      text.match(/\d{3}-\d{2}-\d{5}/)?.[0];
    return { businessName: readText(raw.businessName), registrationNumber, raw };
  }
}

function readText(value: unknown): string | undefined {
  return typeof value === 'object' &&
    value !== null &&
    typeof (value as { text?: unknown }).text === 'string'
    ? (value as { text: string }).text
    : undefined;
}
