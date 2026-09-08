import { Injectable } from '@nestjs/common';
import { env } from '../../../config/env.js';

export interface OcrResult {
  businessName?: string;
  registrationNumber?: string;
  raw: Record<string, unknown>;
}

// TODO: implement the actual CLOVA OCR "business license" template request.
// https://api.ncloud-docs.com/docs/ai-application-service-ocr
@Injectable()
export class ClovaOcrClient {
  async recognizeBusinessLicense(_fileUrl: string): Promise<OcrResult> {
    if (!env.clovaOcrApiUrl || !env.clovaOcrSecretKey) {
      throw new Error('CLOVA_OCR_API_URL / CLOVA_OCR_SECRET_KEY is not configured');
    }
    throw new Error('Not implemented yet');
  }
}
