import { Injectable } from '@nestjs/common';
import { env } from '../../../config/env.js';

export interface NtsCheckResult {
  valid: boolean;
  status?: string;
  message?: string;
  raw?: Record<string, unknown>;
}

interface NtsStatusResponse {
  status_code?: string;
  data?: Array<{
    b_no?: string;
    valid?: string;
    b_stt?: string;
    b_stt_cd?: string;
    tax_type?: string;
  }>;
}

const NTS_STATUS_ENDPOINT = 'https://api.odcloud.kr/api/nts-businessman/v1/status';

@Injectable()
export class NtsClient {
  async verifyBusinessRegistration(
    registrationNumber: string,
    _businessName: string,
  ): Promise<NtsCheckResult> {
    if (!env.ntsApiKey) {
      throw new Error('NTS_API_KEY is not configured');
    }

    const businessNumber = registrationNumber.replace(/\D/g, '');
    if (!/^\d{10}$/.test(businessNumber)) {
      return {
        valid: false,
        message: '사업자등록번호는 숫자 10자리여야 합니다.',
      };
    }

    const url = new URL(NTS_STATUS_ENDPOINT);
    url.searchParams.set('serviceKey', env.ntsApiKey);
    url.searchParams.set('returnType', 'JSON');

    const response = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ b_no: [businessNumber] }),
    });
    const body = (await response.json().catch(() => ({}))) as NtsStatusResponse;
    if (!response.ok || (body.status_code !== undefined && body.status_code !== 'OK')) {
      throw new Error(`NTS status lookup failed (${body.status_code ?? response.status})`);
    }

    const result = body.data?.[0];
    const valid = result?.b_stt_cd ? result.b_stt_cd === '01' : result?.valid === '01';
    return {
      valid,
      status: result?.b_stt ?? (!result ? 'unrecognized' : undefined),
      message: valid ? undefined : result?.tax_type ?? result?.b_stt ?? '국세청에서 사업자 상태를 확인할 수 없습니다.',
      raw: result,
    };
  }
}
