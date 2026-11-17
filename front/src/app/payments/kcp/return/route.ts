import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/api-base-url';

/**
 * KCP 모바일 결제창 인증 결과(Ret_URL) 수신 — KCP가 가맹점 브라우저를 통해 전체 페이지 POST로 본다.
 * API(/payments/kcp/return)가 승인·정산을 끝내고 돌려준 결과를 브라우저 성공/실패 페이지 리다이렉트로 옮긴다.
 * KCP 콜백 본문은 EUC-KR으로 날아올 수 있지만 로직에 쓰는 res_cd·enc_info·enc_data·ordr_idxx는
 * ASCII라 깨지지 않고, 한글(res_msg)은 사용하지 않는다.
 */

interface KcpMobileOutcome {
  outcome: 'success' | 'failed';
  orderId?: string;
  flow?: 'ad' | 'design';
  code?: string;
}

export async function POST(request: Request) {
  const outcome = await settle(request);
  const target = outcome.outcome === 'success' ? '/payments/success' : '/payments/fail';
  const url = new URL(target, request.url);
  if (outcome.orderId) url.searchParams.set('orderId', outcome.orderId);
  if (outcome.flow) url.searchParams.set('flow', outcome.flow);
  if (outcome.outcome === 'success') {
    // 서버가 이미 승인·정산을 끝냈으므로 성공 페이지는 주문 폴리만 수행한다.
    url.searchParams.set('provider', 'kcp');
  } else {
    url.searchParams.set('code', outcome.code ?? 'res_error');
  }
  return NextResponse.redirect(url, 302);
}

// API에 인증 필드를 그대로 전달해 승인·정산을 맡기고 결과만 받아온다. API 불능 등으로 확인이
// 불가능하면 일단 실패 페이지로 본다 — pending 주문은 그 화면에서 취소된다.
async function settle(request: Request): Promise<KcpMobileOutcome> {
  try {
    const formData = await request.formData();
    const fields = Object.fromEntries(
      [...formData.entries()].map(([key, value]) => [key, String(value)]),
    );
    const apiBase = getApiBaseUrl();
    // 서버 런타임에서 상대 '/api'면 요청 오리진(bz)의 same-origin 프록시로 절대화한다.
    const apiUrl = apiBase.startsWith('http') ? apiBase : new URL(apiBase, request.url).toString();
    const response = await fetch(`${apiUrl}/payments/kcp/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`API responded ${response.status}`);
    return (await response.json()) as KcpMobileOutcome;
  } catch {
    return { outcome: 'failed', code: 'res_error' };
  }
}
