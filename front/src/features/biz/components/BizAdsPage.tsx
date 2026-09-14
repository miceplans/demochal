'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { DayPicker, type DateRange } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { BizContent, OutlineButton, PrimaryButton } from '@/components/biz/BizShell';
import {
  AdPlacementPreview,
  type AdPlacement,
  type AdPreviewView,
} from '@/components/ads/AdPlacementPreview';
import type { Ad, AdProduct, Notification } from '@semochal/api-client';
import { adApi, adError } from '@/lib/ad-api';

type AdsScreen = 'manage' | 'products' | 'complete';
type SelectedAd = {
  placement: AdPlacement;
  name: string;
  price: number;
  period: string;
  product: AdProduct;
};

const ViewToggle = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 20px',
  borderRadius: 6,
  background: c.white,
});
const ViewTab = styled('button', { shouldForwardProp: (prop) => prop !== 'active' })<{
  active: boolean;
}>(({ active }) => ({
  width: 80,
  border: 0,
  borderRadius: 6,
  padding: 10,
  background: active ? c.primary : 'transparent',
  color: active ? c.white : c.gray900,
  ...textStyle.subtitle,
}));
const ManageBody = styled(BizContent)({ maxWidth: 1100, gap: 48 });
const HeaderRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
});
const ManageSection = styled.section({ display: 'flex', flexDirection: 'column', gap: 16 });
const AdsTable = styled.div({
  overflow: 'hidden',
  border: `1px solid ${c.gray200}`,
  borderRadius: 12,
});
const TableRow = styled.div({
  display: 'grid',
  gridTemplateColumns: '180px 180px 1fr',
  alignItems: 'center',
  minHeight: 56,
  padding: '0 16px',
  borderTop: `1px solid ${c.gray200}`,
  ...textStyle.body,
});
const TableHead = styled(TableRow)({
  minHeight: 48,
  borderTop: 0,
  background: c.gray100,
  ...textStyle.h1,
});
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
const PaymentBackdrop = styled.div({
  position: 'fixed',
  zIndex: 100,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: 'rgba(17, 24, 39, .46)',
});
const PaymentPopup = styled.div({
  width: 'min(100%, 384px)',
  padding: 30,
  borderRadius: 9,
  background: c.white,
  boxShadow: '0 20px 48px rgba(17, 24, 39, .22)',
});
const PaymentDate = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  color: c.gray900,
  ...textStyle.metaText,
});
const PaymentDateText = styled.span({ color: c.gray900, ...textStyle.metaText });
const CalendarToggle = styled('button', { shouldForwardProp: (prop) => prop !== 'active' })<{
  active?: boolean;
}>(({ active }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  padding: 0,
  border: 0,
  borderRadius: 6,
  background: active ? c.gray100 : 'transparent',
  cursor: 'pointer',
}));
const CalendarIcon = styled.img({ width: 15, height: 15 });
const CalendarPopover = styled.div({
  position: 'absolute',
  zIndex: 10,
  top: 'calc(100% + 6px)',
  left: 0,
  width: 'max-content',
  padding: 14,
  borderRadius: 10,
  background: c.white,
  border: `1px solid ${c.gray200}`,
  boxShadow: '0 12px 28px rgba(17, 24, 39, .18)',
});
const CalendarDayPicker = styled(DayPicker)({
  '--rdp-accent-color': c.primary,
  '--rdp-accent-background-color': c.lightBlue,
  '--rdp-today-color': c.primary,
  '--rdp-day-width': '30px',
  '--rdp-day-height': '30px',
  '--rdp-day_button-width': '30px',
  '--rdp-day_button-height': '30px',
  '--rdp-day_button-border': 'none',
  '--rdp-selected-border': 'none',
  '--rdp-nav_button-width': '22px',
  '--rdp-nav_button-height': '22px',
  '--rdp-nav-height': '26px',
  '--rdp-weekday-opacity': 1,
  '--rdp-outside-opacity': 1,
  fontFamily: textStyle.metaText.fontFamily,
  '.rdp-month_caption': { ...textStyle.subtitle, color: c.gray900, justifyContent: 'center' },
  '.rdp-weekday': { ...textStyle.label, color: c.gray500 },
  '.rdp-day_button': { ...textStyle.metaText, color: c.gray900 },
  '.rdp-outside .rdp-day_button': { color: c.gray300 },
  '.rdp-chevron': { fill: c.gray700 },
});
const PopupAction = styled('button', { shouldForwardProp: (prop) => prop !== 'secondary' })<{
  secondary?: boolean;
}>(({ secondary }) => ({
  height: 37,
  border: secondary ? `1px solid ${c.gray200}` : 0,
  borderRadius: 6,
  background: secondary ? c.white : c.primary,
  color: secondary ? c.gray900 : c.white,
  cursor: 'pointer',
  fontSize: secondary ? 12 : 13,
  fontWeight: 600,
  lineHeight: secondary ? 'normal' : 1.4,
}));

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatSlash(dateKey: string) {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}/${Number(day)}`;
}

export function BizAdsPage() {
  const [contracts, setContracts] = useState<Ad[]>([]);
  const [priceNotices, setPriceNotices] = useState<Notification[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    adApi.ads
      .listMine()
      .then(setContracts)
      .catch((error) => setError(adError(error)));
  }, []);
  useEffect(() => {
    const refresh = () =>
      adApi.notifications
        .list()
        .then((items) => setPriceNotices(items.filter((item) => item.type === 'ad_price_changed')))
        .catch((error) => setError(adError(error)));
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const [view, setView] = useState<AdPreviewView>('pc');
  const [screen, setScreen] = useState<AdsScreen>('manage');
  const [selectedAd, setSelectedAd] = useState<SelectedAd | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStart, setPaymentStart] = useState(() => toDateKey(new Date()));
  const [paymentEnd, setPaymentEnd] = useState(() => toDateKey(new Date()));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>();
  const [calendarViewMonth, setCalendarViewMonth] = useState(() => new Date());
  const datePickerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const openPayment = async (placement: AdPlacement) => {
    setError('');
    try {
      const products = await adApi.ads.listProducts();
      const product = products.find((item) => item.placement === placement);
      if (!product) throw new Error('상품 없음');
      let start = toDateKey(new Date());
      for (const period of [...(product.reservedPeriods ?? [])].sort((a, b) =>
        a.startDate.localeCompare(b.startDate),
      )) {
        if (period.startDate.slice(0, 10) <= start && period.endDate.slice(0, 10) >= start) {
          start = new Date(new Date(period.endDate.slice(0, 10)).getTime() + 86_400_000)
            .toISOString()
            .slice(0, 10);
        }
      }
      setSelectedAd({
        placement,
        name: product.name,
        price: product.dailyPrice,
        period: start,
        product,
      });
      setPaymentStart(start);
      setPaymentEnd(start);
      setPendingRange({ from: new Date(`${start}T00:00:00`), to: new Date(`${start}T00:00:00`) });
      setDatePickerOpen(false);
      setPaymentOpen(true);
    } catch (error) {
      setError(adError(error));
    }
  };
  const paymentDays = Math.max(
    1,
    Math.round((new Date(paymentEnd).getTime() - new Date(paymentStart).getTime()) / 86_400_000) +
      1,
  );
  const paymentAmount = paymentDays * (selectedAd?.product.dailyPrice ?? 0);
  const reserved = selectedAd?.product.reservedPeriods ?? [];
  const overlaps = reserved.some(
    (period) =>
      period.startDate.slice(0, 10) <= paymentEnd && period.endDate.slice(0, 10) >= paymentStart,
  );
  const submitReservation = async () => {
    if (!selectedAd || submitting || overlaps) return;
    setSubmitting(true);
    setError('');
    try {
      const ad = await adApi.ads.create({
        productId: selectedAd.product.id,
        startDate: paymentStart,
        endDate: paymentEnd,
        expectedDailyPrice: selectedAd.product.dailyPrice,
      });
      setContracts((items) => [ad, ...items]);
      setSelectedAd({
        ...selectedAd,
        price: ad.paidAmount,
        period: `${paymentStart} ~ ${paymentEnd}`,
      });
      setPaymentOpen(false);
      setScreen('complete');
    } catch (error) {
      setError(adError(error));
      try {
        const products = await adApi.ads.listProducts();
        const product = products.find((item) => item.id === selectedAd.product.id);
        if (product) setSelectedAd({ ...selectedAd, product });
      } catch {
        /* Keep the original actionable error. */
      }
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!datePickerOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [datePickerOpen]);

  const toggleDatePicker = () => {
    setDatePickerOpen((open) => {
      const next = !open;
      if (next) {
        setCalendarViewMonth(new Date(`${paymentStart}T00:00:00`));
        setPendingRange({
          from: new Date(`${paymentStart}T00:00:00`),
          to: new Date(`${paymentEnd}T00:00:00`),
        });
      }
      return next;
    });
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setPendingRange(range);
    if (!range?.from) return;
    setPaymentStart(toDateKey(range.from));
    setPaymentEnd(toDateKey(range.to ?? range.from));
    if (range.to) setDatePickerOpen(false);
  };

  if (screen === 'manage')
    return (
      <ManageBody>
        {error && <p role="alert">{error}</p>}
        {priceNotices.map((notice) => (
          <p role="status" key={notice.id}>
            {String(
              notice.payload.message ??
                '광고 단가가 변경되었습니다. 기존 계약의 금액과 기간은 유지됩니다.',
            )}
          </p>
        ))}
        <section
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          aria-labelledby="current-ad-title"
        >
          <HeaderRow>
            <h1 id="current-ad-title" style={{ margin: 0, ...textStyle.display }}>
              현재 나의 광고
            </h1>
            <span style={{ display: 'flex', gap: 8 }}>
              <OutlineButton type="button" onClick={() => setScreen('products')}>
                수정하기
              </OutlineButton>
              <PrimaryButton type="button" onClick={() => router.push('/biz/reports')}>
                리포트 보기
              </PrimaryButton>
            </span>
          </HeaderRow>
          <p>
            기존 계약의 결제 금액과 기간은 단가가 변경되어도 유지됩니다. 새 계약에는 신청 시점의
            최신 단가가 적용됩니다.
          </p>
        </section>
        <ManageSection aria-labelledby="ad-management-title">
          <HeaderRow>
            <h2 id="ad-management-title" style={{ margin: 0, ...textStyle.h1_2 }}>
              광고 관리
            </h2>
            <PrimaryButton type="button" onClick={() => setScreen('products')}>
              광고 추가
            </PrimaryButton>
          </HeaderRow>
          <AdsTable role="table" aria-label="광고 관리 목록">
            <TableHead role="row">
              <span role="columnheader">제목 / 계약 기간</span>
              <span role="columnheader">계약 금액</span>
              <span role="columnheader" style={{ justifySelf: 'end', width: 80 }}>
                상태
              </span>
            </TableHead>
            {contracts.map((ad) => (
              <TableRow key={ad.id} role="row">
                <span role="cell">
                  {ad.title}
                  <small style={{ display: 'block' }}>
                    {ad.startDate.slice(0, 10)} ~ {ad.endDate.slice(0, 10)}
                  </small>
                </span>
                <span role="cell">{ad.paidAmount.toLocaleString()}원</span>
                <span role="cell" style={{ justifySelf: 'end', width: 80 }}>
                  {ad.status === 'preparing'
                    ? '결제 대기'
                    : ad.status === 'ended' || ad.endDate.slice(0, 10) < toDateKey(new Date())
                      ? '종료'
                      : ad.status === 'paused'
                        ? '일시 정지'
                        : ad.startDate.slice(0, 10) > toDateKey(new Date())
                          ? '시작 대기'
                          : '진행중'}
                </span>
              </TableRow>
            ))}
          </AdsTable>
        </ManageSection>
      </ManageBody>
    );

  if (screen === 'complete' && selectedAd)
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

  return (
    <BizContent style={{ maxWidth: 1220, gap: 32, alignItems: 'center' }}>
      {error && <p role="alert">{error}</p>}
      <HeaderRow style={{ width: '100%' }}>
        <OutlineButton type="button" onClick={() => setScreen('manage')}>
          광고 관리로 돌아가기
        </OutlineButton>
        <ViewToggle role="tablist" aria-label="광고 노출 화면">
          <ViewTab
            type="button"
            role="tab"
            active={view === 'mobile'}
            aria-selected={view === 'mobile'}
            onClick={() => setView('mobile')}
          >
            모바일 뷰
          </ViewTab>
          <ViewTab
            type="button"
            role="tab"
            active={view === 'pc'}
            aria-selected={view === 'pc'}
            onClick={() => setView('pc')}
          >
            PC 뷰
          </ViewTab>
        </ViewToggle>
      </HeaderRow>
      <AdPlacementPreview view={view} onSelect={openPayment} />
      {paymentOpen &&
        selectedAd &&
        typeof document !== 'undefined' &&
        createPortal(
          <PaymentBackdrop role="presentation" onMouseDown={() => setPaymentOpen(false)}>
            <PaymentPopup
              role="dialog"
              aria-modal="true"
              aria-labelledby="biz-payment-popup-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                  <h2 id="biz-payment-popup-title" style={{ margin: 0, ...textStyle.h1_2 }}>
                    광고 계약 신청
                  </h2>
                  <p style={{ margin: 0 }}>
                    새 계약 하루 광고비 {selectedAd.product.dailyPrice.toLocaleString()}원 · 종료일
                    포함 {paymentDays}일
                  </p>
                  <p style={{ margin: 0 }}>
                    기존 계약 종료일 다음 날부터 신청할 수 있습니다. 기존 계약의 금액과 기간은
                    유지됩니다.
                  </p>
                  {reserved.map((period) => (
                    <small key={period.startDate}>
                      예약 불가: {period.startDate.slice(0, 10)} ~ {period.endDate.slice(0, 10)}
                    </small>
                  ))}
                  {error && <p role="alert">{error}</p>}
                  {overlaps && <p role="alert">이미 계약된 기간이 포함되어 있습니다.</p>}
                  <div style={{ position: 'relative' }} ref={datePickerRef}>
                    <PaymentDate>
                      <PaymentDateText>
                        {formatSlash(paymentStart)}~{formatSlash(paymentEnd)}
                      </PaymentDateText>
                      <CalendarToggle
                        type="button"
                        active={datePickerOpen}
                        aria-label="광고 기간 선택"
                        aria-expanded={datePickerOpen}
                        onClick={toggleDatePicker}
                      >
                        <CalendarIcon src="/assets/icons/figma-role-calendar.svg" alt="" />
                      </CalendarToggle>
                      <span>까지 광고비</span>
                    </PaymentDate>
                    {datePickerOpen && (
                      <CalendarPopover role="dialog" aria-label="광고 기간 달력">
                        <CalendarDayPicker
                          mode="range"
                          disabled={[
                            { before: new Date(`${toDateKey(new Date())}T00:00:00`) },
                            ...reserved.map((period) => ({
                              from: new Date(`${period.startDate.slice(0, 10)}T00:00:00`),
                              to: new Date(`${period.endDate.slice(0, 10)}T00:00:00`),
                            })),
                          ]}
                          excludeDisabled
                          locale={ko}
                          navLayout="around"
                          showOutsideDays
                          resetOnSelect
                          selected={pendingRange}
                          month={calendarViewMonth}
                          onMonthChange={setCalendarViewMonth}
                          onSelect={handleRangeSelect}
                        />
                      </CalendarPopover>
                    )}
                    <strong
                      style={{
                        display: 'block',
                        marginTop: 1,
                        fontSize: 24,
                        fontWeight: 600,
                        lineHeight: 1.3,
                        letterSpacing: '-0.24px',
                      }}
                    >
                      {paymentAmount.toLocaleString()}원
                    </strong>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                  <PopupAction type="button" secondary onClick={() => setPaymentOpen(false)}>
                    취소
                  </PopupAction>
                  <PopupAction
                    type="button"
                    disabled={submitting || overlaps}
                    onClick={submitReservation}
                  >
                    {submitting ? '신청 중…' : '계약 신청'}
                  </PopupAction>
                </div>
              </div>
            </PaymentPopup>
          </PaymentBackdrop>,
          document.body,
        )}
    </BizContent>
  );
}
