'use client';

import { BizLink } from '@/components/biz/BizShell';
import { Content } from '@/components/common/UserShell';
import { Heading, Icon, Stack, Title } from '@/components/common/Primitives';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

// 광고 상품 안내(AdvertisingProductsPage)와 같은 문서형 구조: 제목 · 소개 · (불릿 제목 + 본문) 섹션.
// TODO: 구독 요금(플랜별 월 금액)이 확정되면 '요금 및 결제 안내' 섹션에 금액을 명시한다.
const sections = [
  {
    heading: '챌린지 공고 등록',
    body: [
      '제공 범위: 챌린지·행사 공고 등록과 수정',
      '공고를 등록하면 SEMO 이용자에게 노출되어 참가자를 모집할 수 있습니다.',
      '신청서 양식을 직접 구성하고, 모집 기간과 정원을 설정해 운영합니다.',
    ],
  },
  {
    heading: '지원자 관리',
    body: [
      '제공 범위: 신청 내역 조회와 응답 관리',
      '접수된 신청서를 한곳에서 확인하고 승인·반려 등 처리 상태를 관리합니다.',
      '신청자별 응답 내용을 확인하고 행사별로 모아 볼 수 있습니다.',
    ],
  },
  {
    heading: '성과 확인',
    body: [
      '제공 범위: 대시보드와 리포트',
      '공고별 조회·신청 현황과 광고 노출·클릭 성과를 대시보드와 리포트로 확인합니다.',
      '운영 결과를 바탕으로 다음 행사 기획에 활용할 수 있습니다.',
    ],
  },
  {
    heading: '운영대행 상담',
    body: [
      '제공 범위: 온라인 상담 및 견적 문의',
      '기획부터 결과 보고까지 필요한 단계만 선택해 운영대행을 요청할 수 있습니다.',
      '상담 후 안내되는 견적에 따라 진행되며, 구독과 별도로 비용이 발생할 수 있습니다.',
    ],
  },
  {
    heading: '요금 및 결제 안내',
    body: [
      '구독 요금은 이용 중인 상품 기준으로 정기 결제됩니다.',
      '결제수단은 결제 관리 화면에서 카드를 등록해 사용하며, 결제 내역은 같은 화면에서 확인할 수 있습니다.',
      '해지와 환불은 환불 기준에 따라 처리되며, 결제 내역에서 환불을 요청할 수 있습니다.',
    ],
  },
] as const;

export function SubscriptionProductsPage() {
  return (
    <Content>
      <Stack gap={24}>
        <Title style={{ fontSize: 32, fontWeight: 700, lineHeight: 'normal', color: c.gray900 }}>
          구독 상품 안내
        </Title>
        <p style={{ ...textStyle.body, color: c.gray700, whiteSpace: 'pre-wrap' }}>
          공고 등록부터 지원자 관리, 성과 확인까지 행사 운영에 필요한 기능을 구독으로 이용해 보세요.
          정확한 이용 금액은 결제 화면에서 확인할 수 있습니다.
        </p>
        {sections.map((s) => (
          <section key={s.heading}>
            <Heading
              style={{
                ...textStyle.h1_2,
                color: c.gray900,
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Icon src="/assets/icons/bullet-icon.png" width={8} height={23} alt="" />
              {s.heading}
            </Heading>
            <p style={{ ...textStyle.body, color: c.gray900, whiteSpace: 'pre-line' }}>
              {s.body.join('\n')}
            </p>
          </section>
        ))}
        <p style={{ ...textStyle.body, color: c.gray700 }}>
          자세한 환불 조건은{' '}
          <BizLink href="/refund-policy" style={{ color: c.primary }}>
            환불 정책
          </BizLink>
          에서 확인할 수 있습니다.
        </p>
      </Stack>
    </Content>
  );
}
