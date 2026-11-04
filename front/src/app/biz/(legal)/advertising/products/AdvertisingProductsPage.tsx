'use client';

import styled from '@emotion/styled';
import { BizContent, BizLink } from '@/components/biz/BizShell';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';

const products = [
  {
    name: '홈 히어로 배너',
    placement: '홈 상단 메인 배너',
    description: '서비스 첫 화면 상단에서 가장 먼저 보이는 대형 배너 상품입니다.',
    details: ['홈 상단 캐러셀 노출', '광고 이미지와 광고명 등록', '클릭 시 지정 랜딩 페이지 이동'],
  },
  {
    name: '갤러리 노출',
    placement: '홈 중간 이미지 영역',
    description: '콘텐츠를 탐색하는 이용자에게 이미지 중심으로 자연스럽게 노출되는 상품입니다.',
    details: [
      '홈 중간 갤러리 영역 노출',
      '광고 이미지와 광고명 등록',
      '클릭 시 지정 랜딩 페이지 이동',
    ],
  },
] as const;

export function AdvertisingProductsPage() {
  return (
    <Page>
      <BizContent>
        <BackLink href="/ads">← 광고 관리로 돌아가기</BackLink>
        <Intro>
          <Eyebrow>SEMO.BIZ ADVERTISING</Eyebrow>
          <Title>광고 상품 안내</Title>
          <Lead>
            챌린지와 브랜드에 맞는 노출 상품을 선택해 보세요. 실제 결제 금액은 신청 시점의 서버
            단가와 선택한 광고 기간을 기준으로 계산됩니다.
          </Lead>
        </Intro>
        <ProductGrid aria-label="광고 상품 목록">
          {products.map((product) => (
            <ProductCard key={product.name}>
              <ProductTop>
                <ProductName>{product.name}</ProductName>
                <Placement>{product.placement}</Placement>
              </ProductTop>
              <ProductDescription>{product.description}</ProductDescription>
              <DetailList>
                {product.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </DetailList>
              <PriceNote>일 단위 과금 · 현재 단가는 결제 화면에서 확인</PriceNote>
            </ProductCard>
          ))}
        </ProductGrid>
        <GuideGrid>
          <GuideSection>
            <SectionTitle>신청 및 심사</SectionTitle>
            <GuideList>
              <li>광고 이미지 업로드 후 광고명과 선택 사항인 랜딩 링크를 등록합니다.</li>
              <li>노출 시작일과 종료일을 선택하면 선택한 일수만큼 광고비가 계산됩니다.</li>
              <li>결제와 광고 소재 심사가 완료된 뒤 계약 기간에 맞춰 노출이 시작됩니다.</li>
              <li>
                소재 심사는 허위·과장, 청소년 유해성, 저작권 침해 여부 등을 기준으로 진행됩니다.
              </li>
            </GuideList>
          </GuideSection>
          <GuideSection>
            <SectionTitle>노출 및 결제 안내</SectionTitle>
            <GuideList>
              <li>광고는 상품별 지정 위치에서 로테이션 방식으로 노출될 수 있습니다.</li>
              <li>광고비는 상품별 일 단가에 선택한 노출 일수를 곱해 계산합니다.</li>
              <li>광고 개시 전 취소 또는 심사 반려 시 환불 기준에 따라 처리됩니다.</li>
              <li>
                광고 개시 후 취소는 이미 제공된 노출 기간을 공제한 뒤 잔여 금액을 환불할 수
                있습니다.
              </li>
            </GuideList>
          </GuideSection>
        </GuideGrid>
        <PolicyNote>
          자세한 게재 기준과 환불 조건은 <BizLink href="/advertising">광고 운영정책</BizLink>에서
          확인할 수 있습니다.
        </PolicyNote>
      </BizContent>
    </Page>
  );
}

const Page = styled.main({
  width: '100%',
  padding: '64px 24px 96px',
  [mobile]: { padding: '40px 16px 64px' },
});
const BackLink = styled(BizLink)({
  alignSelf: 'flex-start',
  color: c.gray500,
  textDecoration: 'none',
  ...textStyle.caption2,
  '&:hover': { color: c.primary },
});
const Intro = styled.div({ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 680 });
const Eyebrow = styled.span({ color: c.primary, ...textStyle.overline, letterSpacing: '0.08em' });
const Title = styled.h1({ margin: 0, color: c.gray900, ...textStyle.display });
const Lead = styled.p({ margin: 0, color: c.gray500, ...textStyle.bodyLarge });
const ProductGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 16,
  [mobile]: { gridTemplateColumns: '1fr' },
});
const ProductCard = styled.section({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 24,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 12,
  background: c.white,
});
const ProductTop = styled.div({ display: 'flex', flexDirection: 'column', gap: 6 });
const ProductName = styled.h2({ margin: 0, color: c.gray900, ...textStyle.h1_2 });
const Placement = styled.span({ color: c.primary, ...textStyle.subtitle });
const ProductDescription = styled.p({ margin: 0, color: c.gray700, ...textStyle.body });
const DetailList = styled.ul({
  margin: 0,
  paddingLeft: 20,
  color: c.gray900,
  ...textStyle.body,
  lineHeight: 1.8,
});
const PriceNote = styled.p({
  margin: 'auto 0 0',
  paddingTop: 12,
  borderTop: `0.5px solid ${c.gray100}`,
  color: c.gray500,
  ...textStyle.caption,
});
const GuideGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 32,
  paddingTop: 16,
  borderTop: `0.5px solid ${c.gray200}`,
  [mobile]: { gridTemplateColumns: '1fr', gap: 28 },
});
const GuideSection = styled.section({ display: 'flex', flexDirection: 'column', gap: 12 });
const SectionTitle = styled.h2({ margin: 0, color: c.gray900, ...textStyle.h2_2 });
const GuideList = styled.ul({
  margin: 0,
  paddingLeft: 20,
  color: c.gray700,
  ...textStyle.body,
  lineHeight: 1.8,
});
const PolicyNote = styled.p({
  margin: 0,
  color: c.gray500,
  ...textStyle.caption,
  '& a': { color: c.primary },
});
