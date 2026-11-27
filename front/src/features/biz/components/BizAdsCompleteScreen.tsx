'use client';

import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { BizContent, PrimaryButton } from '@/components/biz/BizShell';
import type { BizAdsController } from './useBizAdsController';

// 광고 계약 신청 완료 화면: 결제 대기 안내와 광고 관리로의 이동을 담당한다.
export function BizAdsCompleteScreen({ controller }: { controller: BizAdsController }) {
  const { selectedAd, setScreen } = controller;
  if (!selectedAd) return null;
  return (
    <CheckoutBody style={{ alignItems: 'center', paddingTop: 110 }}>
      <SuccessIcon aria-hidden>✓</SuccessIcon>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ margin: 0, ...textStyle.h1_2 }}>광고 계약 신청이 완료되었습니다</h1>
        <p>
          {selectedAd.name} · {selectedAd.period} · {selectedAd.price.toLocaleString()}원
        </p>
        <p>결제 대기 중입니다. 결제 확인 후 계약 기간에 광고가 진행됩니다.</p>
      </div>
      <PrimaryButton type="button" onClick={() => setScreen('manage')}>
        광고 관리로 이동
      </PrimaryButton>
    </CheckoutBody>
  );
}

const CheckoutBody = styled(BizContent)({ maxWidth: 680, gap: 24, paddingTop: 36 });
const SuccessIcon = styled.div({
  width: 56,
  height: 56,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  margin: '0 auto',
  background: '#e7f2ff',
  color: c.primary,
  fontSize: 28,
  fontWeight: 700,
});
