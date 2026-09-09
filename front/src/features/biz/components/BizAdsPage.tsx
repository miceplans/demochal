'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { BizContent, OutlineButton, PrimaryButton } from '@/components/biz/BizShell';
import { AdPlacementPreview, type AdPlacement, type AdPreviewView } from '@/components/ads/AdPlacementPreview';
import { myAds, paymentCard } from '@/data/biz-design';

type AdsScreen = 'manage' | 'products' | 'checkout' | 'complete';
type SelectedAd = { placement: AdPlacement; name: string; price: number; period: string };

const ViewToggle = styled.div({ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 20px', borderRadius: 6, background: c.white });
const ViewTab = styled('button', { shouldForwardProp: (prop) => prop !== 'active' })<{ active: boolean }>(({ active }) => ({ width: 80, border: 0, borderRadius: 6, padding: 10, background: active ? c.primary : 'transparent', color: active ? c.white : c.gray900, ...textStyle.subtitle }));
const ManageBody = styled(BizContent)({ maxWidth: 1100, gap: 48 });
const HeaderRow = styled.div({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 });
const CurrentHero = styled.img({ width: '100%', height: 236, objectFit: 'cover', borderRadius: 12 });
const ManageSection = styled.section({ display: 'flex', flexDirection: 'column', gap: 16 });
const AdsTable = styled.div({ overflow: 'hidden', border: `1px solid ${c.gray200}`, borderRadius: 12 });
const TableRow = styled.div({ display: 'grid', gridTemplateColumns: '180px 180px 1fr', alignItems: 'center', minHeight: 56, padding: '0 16px', borderTop: `1px solid ${c.gray200}`, ...textStyle.body });
const TableHead = styled(TableRow)({ minHeight: 48, borderTop: 0, background: c.gray100, ...textStyle.h1 });
const CheckoutBody = styled(BizContent)({ maxWidth: 680, gap: 24, paddingTop: 36 });
const CheckoutCard = styled.section({ border: `1px solid ${c.gray200}`, borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', gap: 18 });
const CheckoutRow = styled.div({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, ...textStyle.body });
const Divider = styled.div({ height: 1, background: c.gray200 });
const PaymentMethod = styled.div({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, border: `1px solid ${c.primary}`, borderRadius: 8, background: '#f8fbff' });
const SuccessIcon = styled.div({ width: 56, height: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto', background: '#e7f2ff', color: c.primary, fontSize: 28, fontWeight: 700 });
const PaymentBackdrop = styled.div({ position: 'fixed', zIndex: 100, inset: 0, display: 'grid', placeItems: 'center', padding: 24, background: 'rgba(17, 24, 39, .46)' });
const PaymentPopup = styled.div({ width: 'min(100%, 384px)', padding: 30, borderRadius: 9, background: c.white, boxShadow: '0 20px 48px rgba(17, 24, 39, .22)' });
const PaymentDate = styled.div({ display: 'flex', alignItems: 'center', gap: 2, color: c.gray900, ...textStyle.metaText });
const PaymentDateInput = styled.input({ width: 122, height: 28, padding: '4px 8px', border: `0.5px solid ${c.gray200}`, borderRadius: 8, color: c.gray900, background: c.white, ...textStyle.metaText });
const PopupAction = styled('button', { shouldForwardProp: (prop) => prop !== 'secondary' })<{ secondary?: boolean }>(({ secondary }) => ({ height: 37, border: secondary ? `1px solid ${c.gray200}` : 0, borderRadius: 6, background: secondary ? c.white : c.primary, color: secondary ? c.gray900 : c.white, cursor: 'pointer', fontSize: secondary ? 12 : 13, fontWeight: 600, lineHeight: secondary ? 'normal' : 1.4 }));

function selectionFor(placement: AdPlacement): SelectedAd {
  return placement === 'hero'
    ? { placement, name: '홈 상단 배너 광고', price: 100000, period: '2026. 08. 25. ~ 2026. 09. 24.' }
    : { placement, name: '홈 중간 이미지 광고', price: 60000, period: '2026. 08. 25. ~ 2026. 09. 24.' };
}

export function BizAdsPage() {
  const [view, setView] = useState<AdPreviewView>('pc');
  const [screen, setScreen] = useState<AdsScreen>('manage');
  const [selectedAd, setSelectedAd] = useState<SelectedAd | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStart, setPaymentStart] = useState('2026-08-25');
  const [paymentEnd, setPaymentEnd] = useState('2026-08-27');
  const router = useRouter();
  const openPayment = (placement: AdPlacement) => {
    setSelectedAd(selectionFor(placement));
    setPaymentStart('2026-08-25');
    setPaymentEnd('2026-08-27');
    setPaymentOpen(true);
  };
  const paymentDays = Math.max(1, Math.round((new Date(`${paymentEnd}T00:00:00`).getTime() - new Date(`${paymentStart}T00:00:00`).getTime()) / 86_400_000));
  const paymentAmount = paymentDays * 5000;

  if (screen === 'manage') return <ManageBody>
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }} aria-labelledby="current-ad-title">
      <HeaderRow><h1 id="current-ad-title" style={{ margin: 0, ...textStyle.display }}>현재 나의 광고</h1><span style={{ display: 'flex', gap: 8 }}><OutlineButton type="button" onClick={() => setScreen('products')}>수정하기</OutlineButton><PrimaryButton type="button" onClick={() => router.push('/biz/reports')}>리포트 보기</PrimaryButton></span></HeaderRow>
      <CurrentHero src="/assets/figma-ads/home-hero.png" alt="현재 노출 중인 한국 마라톤 공모전 광고" />
    </section>
    <ManageSection aria-labelledby="ad-management-title"><HeaderRow><h2 id="ad-management-title" style={{ margin: 0, ...textStyle.h1_2 }}>광고 관리</h2><PrimaryButton type="button" onClick={() => setScreen('products')}>광고 추가</PrimaryButton></HeaderRow><AdsTable role="table" aria-label="광고 관리 목록"><TableHead role="row"><span role="columnheader">제목</span><span role="columnheader">금액</span><span role="columnheader" style={{ justifySelf: 'end', width: 80 }}>상태</span></TableHead>{myAds.map((ad) => <TableRow key={ad.title} role="row"><span role="cell">{ad.title}</span><span role="cell">{ad.price}</span><span role="cell" style={{ justifySelf: 'end', width: 80, color: ad.status === '진행중' ? c.primary : c.red }}>{ad.status}</span></TableRow>)}</AdsTable></ManageSection>
  </ManageBody>;

  if (screen === 'checkout' && selectedAd) return <CheckoutBody>
    <HeaderRow><OutlineButton type="button" onClick={() => setScreen('products')}>광고 위치 다시 선택</OutlineButton><h1 style={{ margin: 0, ...textStyle.h1_2 }}>광고 결제</h1></HeaderRow>
    <CheckoutCard><h2 style={{ margin: 0, ...textStyle.h2_2 }}>선택한 광고</h2><CheckoutRow><span>{selectedAd.name}</span><strong>{selectedAd.price.toLocaleString()}원</strong></CheckoutRow><CheckoutRow><span style={{ color: c.gray500 }}>노출 기간</span><span>{selectedAd.period}</span></CheckoutRow></CheckoutCard>
    <CheckoutCard><h2 style={{ margin: 0, ...textStyle.h2_2 }}>결제수단</h2><PaymentMethod><span><strong>등록된 카드</strong><span style={{ marginLeft: 10, color: c.gray500 }}>{paymentCard.masked}</span></span><span style={{ color: c.primary, ...textStyle.label }}>선택됨</span></PaymentMethod></CheckoutCard>
    <CheckoutCard aria-label="결제 금액"><CheckoutRow><span style={{ color: c.gray500 }}>상품 금액</span><span>{selectedAd.price.toLocaleString()}원</span></CheckoutRow><CheckoutRow><span style={{ color: c.gray500 }}>부가세</span><span>0원</span></CheckoutRow><Divider /><CheckoutRow><strong>총 결제 금액</strong><strong style={{ fontSize: 22, color: c.primary }}>{selectedAd.price.toLocaleString()}원</strong></CheckoutRow></CheckoutCard>
    <PrimaryButton type="button" style={{ height: 52, fontSize: 16 }} onClick={() => setScreen('complete')}>{selectedAd.price.toLocaleString()}원 결제하기</PrimaryButton>
  </CheckoutBody>;

  if (screen === 'complete' && selectedAd) return <CheckoutBody style={{ alignItems: 'center', paddingTop: 110 }}><SuccessIcon aria-hidden>✓</SuccessIcon><div style={{ textAlign: 'center' }}><h1 style={{ margin: 0, ...textStyle.h1_2 }}>광고 결제가 완료되었습니다</h1><p style={{ margin: '10px 0 0', color: c.gray500, ...textStyle.body }}>{selectedAd.name}가 {selectedAd.period} 동안 노출됩니다.</p></div><PrimaryButton type="button" onClick={() => setScreen('manage')}>광고 관리로 이동</PrimaryButton></CheckoutBody>;

  return <BizContent style={{ maxWidth: 1220, gap: 32, alignItems: 'center' }}>
    <HeaderRow style={{ width: '100%' }}><OutlineButton type="button" onClick={() => setScreen('manage')}>광고 관리로 돌아가기</OutlineButton><ViewToggle role="tablist" aria-label="광고 노출 화면"><ViewTab type="button" role="tab" active={view === 'mobile'} aria-selected={view === 'mobile'} onClick={() => setView('mobile')}>모바일 뷰</ViewTab><ViewTab type="button" role="tab" active={view === 'pc'} aria-selected={view === 'pc'} onClick={() => setView('pc')}>PC 뷰</ViewTab></ViewToggle></HeaderRow>
    <AdPlacementPreview view={view} onSelect={openPayment} />
    {paymentOpen && selectedAd && typeof document !== 'undefined' && createPortal(
      <PaymentBackdrop role="presentation" onMouseDown={() => setPaymentOpen(false)}>
        <PaymentPopup role="dialog" aria-modal="true" aria-labelledby="biz-payment-popup-title" onMouseDown={(event) => event.stopPropagation()}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              <h2 id="biz-payment-popup-title" style={{ margin: 0, ...textStyle.h1_2 }}>단기 결제</h2>
              <div>
                <PaymentDate><PaymentDateInput type="date" value={paymentStart} max={paymentEnd} onChange={(event) => { const nextStart = event.target.value; setPaymentStart(nextStart); if (nextStart > paymentEnd) setPaymentEnd(nextStart); }} aria-label="광고 시작일" /><span>~</span><PaymentDateInput type="date" value={paymentEnd} min={paymentStart} onChange={(event) => setPaymentEnd(event.target.value)} aria-label="광고 종료일" /><span>까지 광고비</span></PaymentDate>
                <strong style={{ display: 'block', marginTop: 1, fontSize: 24, fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.24px' }}>{paymentAmount.toLocaleString()}원</strong>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}><PopupAction type="button" secondary onClick={() => setPaymentOpen(false)}>취소</PopupAction><PopupAction type="button" onClick={() => { setPaymentOpen(false); setScreen('complete'); }}>결제하기</PopupAction></div>
          </div>
        </PaymentPopup>
      </PaymentBackdrop>, document.body,
    )}
  </BizContent>;
}
