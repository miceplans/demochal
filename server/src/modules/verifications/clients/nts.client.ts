import { Injectable } from '@nestjs/common';
import { fetchJson } from '../../../common/http/fetch-json.js';
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
  async lookupRegistration(registrationNumber: string): Promise<'registered' | 'unregistered'> {
    const businessNumber = registrationNumber.replace(/\D/g, '');
    if (!/^\d{10}$/.test(businessNumber)) throw new Error('Invalid registration number');
    const result = await this.fetchStatus(businessNumber);
    if (result?.b_no !== businessNumber) throw new Error('Invalid NTS response');
    if (['01', '02', '03'].includes(result.b_stt_cd ?? '')) return 'registered';
    if (
      result.b_stt_cd === '' &&
      result.tax_type?.includes('국세청에 등록되지 않은 사업자등록번호')
    ) {
      return 'unregistered';
    }
    throw new Error('Invalid NTS response');
  }

  async verifyBusinessRegistration(
    registrationNumber: string,
    _businessName: string,
  ): Promise<NtsCheckResult> {
    const businessNumber = registrationNumber.replace(/\D/g, '');
    if (!/^\d{10}$/.test(businessNumber)) {
      return { valid: false, message: '사업자등록번호는 숫자 10자리여야 합니다.' };
    }
    const result = await this.fetchStatus(businessNumber);
    const valid = result?.b_stt_cd ? result.b_stt_cd === '01' : result?.valid === '01';
    return {
      valid,
      status: result?.b_stt ?? (!result ? 'unrecognized' : undefined),
      message: valid
        ? undefined
        : (result?.tax_type ?? result?.b_stt ?? '국세청에서 사업자 상태를 확인할 수 없습니다.'),
      raw: result,
    };
  }

  private async fetchStatus(businessNumber: string) {
    if (!env.ntsApiKey) throw new Error('NTS_API_KEY is not configured');
    const url = new URL(NTS_STATUS_ENDPOINT);
    url.searchParams.set('serviceKey', env.ntsApiKey);
    url.searchParams.set('returnType', 'JSON');
    const response = await fetchJson(url.toString(), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ b_no: [businessNumber] }),
    });
    const body = (await response.json().catch(() => ({}))) as NtsStatusResponse;
    if (!response.ok || (body.status_code !== undefined && body.status_code !== 'OK')) {
      throw new Error('NTS status lookup failed');
    }
    return body.data?.[0];
  }
}
