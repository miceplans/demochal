import { Injectable } from '@nestjs/common';
import { env } from '../../../config/env.js';

export interface NtsCheckResult {
  valid: boolean;
  status?: string;
}

// TODO: implement the actual 국세청 사업자등록정보 진위확인 API call.
// https://www.data.go.kr/data/15081808/openapi.do
@Injectable()
export class NtsClient {
  async verifyBusinessRegistration(
    _registrationNumber: string,
    _businessName: string,
  ): Promise<NtsCheckResult> {
    if (!env.ntsApiKey) {
      throw new Error('NTS_API_KEY is not configured');
    }
    throw new Error('Not implemented yet');
  }
}
