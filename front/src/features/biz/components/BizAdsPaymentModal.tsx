'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { DayPicker } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { useBizHref } from '@/components/biz/BizShell';
import { toDateKey } from '@/lib/date';
import { formatSlash } from './BizAdsPage.logic';
import { PopupAction } from './BizAdsPage.styles';
import type { BizAdsController } from './useBizAdsController';

// 광고 계약 신청(결제 유도) 팝업: 기간 선택 달력과 예상 광고비, 계약 신청 액션을 렌더링한다.
export function BizAdsPaymentModal({ controller }: { controller: BizAdsController }) {
  const {
    paymentOpen,
    setPaymentOpen,
    selectedAd,
    paymentDays,
    paymentAmount,
    reserved,
    paymentStart,
    paymentEnd,
    datePickerOpen,
    pendingRange,
    calendarViewMonth,
    setCalendarViewMonth,
    datePickerRef,
    toggleDatePicker,
    handleRangeSelect,
    draftContent,
    setNameModalPlacement,
    submitting,
    submitReservation,
  } = controller;
  const hrefOf = useBizHref();
  if (!paymentOpen || !selectedAd || typeof document === 'undefined') return null;
  return createPortal(
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
              새 계약 하루 광고비 {selectedAd.product.dailyPrice.toLocaleString()}원 · 종료일 포함{' '}
              {paymentDays}일
            </p>
            <p style={{ margin: 0 }}>
              기존 계약 종료일 다음 날부터 신청할 수 있습니다. 기존 계약의 금액과 기간은 유지됩니다.
            </p>
            <ProductLink href={hrefOf('/advertising/products')}>상품 설명 &gt;</ProductLink>
            <ProductLink href={hrefOf('/refund-policy')}>환불 정책 &gt;</ProductLink>
            {reserved.map((period) => (
              <small key={period.startDate}>
                예약 불가: {period.startDate.slice(0, 10)} ~ {period.endDate.slice(0, 10)}
              </small>
            ))}
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
          {draftContent && draftContent.placement === selectedAd.placement && (
            <PopupAction
              type="button"
              secondary
              onClick={() => {
                setPaymentOpen(false);
                setNameModalPlacement(draftContent.placement);
              }}
            >
              광고 정보 수정
            </PopupAction>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
            <PopupAction type="button" secondary onClick={() => setPaymentOpen(false)}>
              취소
            </PopupAction>
            <PopupAction type="button" disabled={submitting} onClick={submitReservation}>
              {submitting ? '신청 중…' : '계약 신청'}
            </PopupAction>
          </div>
        </div>
      </PaymentPopup>
    </PaymentBackdrop>,
    document.body,
  );
}

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
const ProductLink = styled(Link)({
  alignSelf: 'flex-start',
  color: c.primary,
  textDecoration: 'none',
  ...textStyle.subtitle,
  '&:hover': { textDecoration: 'underline' },
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
  border: `0.5px solid ${c.gray200}`,
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
