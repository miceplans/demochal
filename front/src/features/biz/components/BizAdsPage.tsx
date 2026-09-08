'use client';
import { useState } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  BizContent,
  SectionHeader,
  SectionTitle,
  PrimaryButton,
  OutlineButton,
  TableBox,
  THead,
  TRow,
  Field,
  FieldInput,
} from '@/components/biz/BizShell';
import { adProducts, myAds, won } from '@/data/biz-design';

const Hero = styled.div({
  height: 236,
  borderRadius: 12,
  background: `linear-gradient(120deg, ${c.gray100}, ${c.lightBlue})`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: c.gray500,
});
const ViewToggle = styled.div({
  display: 'flex',
  gap: 8,
  background: c.white,
  borderRadius: 6,
  padding: '6px 20px',
  alignSelf: 'flex-end',
});
const ViewTab = styled.button<{ active?: boolean }>(({ active }) => ({
  border: 0,
  borderRadius: 6,
  padding: '10px 12px',
  background: active ? c.primary : 'transparent',
  color: active ? c.white : c.gray900,
  ...textStyle.subtitle,
}));
const Slots = styled.div({ display: 'flex', gap: 60, justifyContent: 'center' });
const Slot = styled.div<{ wide?: boolean }>(({ wide }) => ({
  width: wide ? 380 : 280,
  height: 252,
  border: '4px dashed #7db2ff',
  borderRadius: 20,
  padding: 8,
}));
const SlotInner = styled.div({
  height: '100%',
  borderRadius: 12,
  background: `linear-gradient(120deg, ${c.gray100}, ${c.lightBlue})`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: c.gray500,
  ...textStyle.caption,
});
const Products = styled.div({ display: 'flex', flexDirection: 'column', gap: 16 });
const Product = styled.div({
  border: `1px solid ${c.gray200}`,
  borderRadius: 12,
  padding: 20,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 24,
});
const Overlay = styled.div({
  position: 'fixed',
  inset: 0,
  background: 'rgba(17,17,17,0.2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
});
const Modal = styled.div({
  width: 607,
  background: c.white,
  borderRadius: 9,
  padding: 30,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});
const ModalTitle = styled.h2(textStyle.display);
const ModalActions = styled.div({ display: 'flex', gap: 15 });
const Col = ({ w, children }: { w?: number; children: React.ReactNode }) => (
  <span style={{ width: w, flexShrink: 0 }}>{children}</span>
);

export function BizAdsPage() {
  const [view, setView] = useState<'mobile' | 'pc'>('mobile');
  const [buying, setBuying] = useState<string | null>(null);
  return (
    <BizContent style={{ maxWidth: 1220 }}>
      <SectionHeader>
        <SectionTitle>현재 나의 광고</SectionTitle>
        <span style={{ display: 'flex', gap: 8 }}>
          <OutlineButton type="button">수정하기</OutlineButton>
          <PrimaryButton>리포트 보기</PrimaryButton>
        </span>
      </SectionHeader>
      <Hero aria-hidden>한국 마라톤 공모전 배너</Hero>
      <section aria-label="광고 관리">
        <SectionHeader>
          <h2 style={{ ...textStyle.h1_2 }}>광고 관리</h2>
          <PrimaryButton>광고 추가</PrimaryButton>
        </SectionHeader>
        <TableBox style={{ marginTop: 16 }}>
          <THead>
            <Col w={300}>제목</Col>
            <Col w={180}>금액</Col>
            <Col w={80}>상태</Col>
          </THead>
          {myAds.map((ad) => (
            <TRow key={ad.title}>
              <Col w={300}>{ad.title}</Col>
              <Col w={180}>{ad.price}</Col>
              <Col w={80}>
                <span style={{ color: ad.status === '진행중' ? c.primary : c.red }}>
                  {ad.status}
                </span>
              </Col>
            </TRow>
          ))}
        </TableBox>
      </section>
      <section aria-label="광고 상품">
        <SectionHeader>
          <SectionTitle>광고 상품</SectionTitle>
          <ViewToggle role="tablist" aria-label="광고 미리보기">
            <ViewTab
              role="tab"
              aria-selected={view === 'mobile'}
              active={view === 'mobile'}
              onClick={() => setView('mobile')}
            >
              모바일 뷰
            </ViewTab>
            <ViewTab
              role="tab"
              aria-selected={view === 'pc'}
              active={view === 'pc'}
              onClick={() => setView('pc')}
            >
              PC 뷰
            </ViewTab>
          </ViewToggle>
        </SectionHeader>
        <Slots>
          {adProducts.map((p, i) => (
            <Slot key={p.name} wide={view === 'pc' && i === 0}>
              <SlotInner>
                {view === 'mobile' ? '모바일' : 'PC'} {p.name} 슬롯 미리보기
              </SlotInner>
            </Slot>
          ))}
        </Slots>
        <Products style={{ marginTop: 32 }}>
          {adProducts.map((p) => (
            <Product key={p.name}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <strong style={{ ...textStyle.h1 }}>{p.name}</strong>
                <span style={{ ...textStyle.caption, color: c.gray700 }}>{p.desc}</span>
                <span style={{ ...textStyle.metaText, color: c.gray500 }}>노출 기간 {p.period}</span>
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                <strong>{won(p.price)}</strong>
                <PrimaryButton onClick={() => setBuying(p.name)}>구매하기</PrimaryButton>
              </span>
            </Product>
          ))}
        </Products>
      </section>
      {buying && (
        <Overlay
          role="dialog"
          aria-modal="true"
          aria-label="광고 등록"
          onClick={() => setBuying(null)}
        >
          <Modal onClick={(e) => e.stopPropagation()}>
            <ModalTitle>광고 등록</ModalTitle>
            <p style={{ ...textStyle.caption, color: c.gray700 }}>
              {buying} 상품을 등록합니다. 결제 방식(단기 결제 / 정기 결제)을 선택하고 광고명을
              입력해주세요.
            </p>
            <Field>
              광고명
              <FieldInput placeholder={`${buying} - 배너`} />
            </Field>
            <Field>
              결제 방식
              <FieldInput placeholder="단기 결제" />
            </Field>
            <ModalActions>
              <OutlineButton type="button" onClick={() => setBuying(null)}>
                취소
              </OutlineButton>
              <PrimaryButton onClick={() => setBuying(null)}>등록하기</PrimaryButton>
            </ModalActions>
          </Modal>
        </Overlay>
      )}
    </BizContent>
  );
}
