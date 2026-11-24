'use client';

import { BizLink } from '@/components/biz/BizShell';
import { Content } from '@/components/common/UserShell';
import { Heading, Icon, Stack, Title } from '@/components/common/Primitives';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

// 광고는 온라인 결제 대신 전화 상담 → 계좌 입금 → 관리자 직접 등록(POST /admin/ads)으로 게재한다.
// 광고 상품 안내(AdvertisingProductsPage)와 동일한 문서형 구조: 제목 · 소개 · (불릿 제목 + 본문) 섹션.
const PHONE = '051-783-1170';
const ACCOUNT = 'KB국민은행 564701-01-619555';

const sections = [
  {
    heading: '문의 전화',
    body: (
      <>
        <a href={`tel:${PHONE.replaceAll('-', '')}`} style={{ color: c.primary }}>
          {PHONE}
        </a>
        {'\n'}광고 위치와 노출 기간, 광고비를 상담해 드립니다.
      </>
    ),
  },
  {
    heading: '입금 계좌',
    body: (
      <>
        {ACCOUNT}
        {'\n'}상담에서 안내받은 광고비를 위 계좌로 입금해 주세요.
      </>
    ),
  },
  {
    heading: '게재 절차',
    body: '전화로 광고 위치와 기간을 상담합니다.\n안내받은 광고비를 입금 계좌로 입금합니다.\n입금이 확인되면 담당자가 광고를 등록하고 계약 기간에 맞춰 노출을 시작합니다.',
  },
] as const;

export function AdInquiryPage() {
  return (
    <Content>
      <Stack gap={24}>
        <Title style={{ fontSize: 32, fontWeight: 700, lineHeight: 'normal', color: c.gray900 }}>
          광고 문의
        </Title>
        <p style={{ ...textStyle.body, color: c.gray700, whiteSpace: 'pre-wrap' }}>
          세모챌 홈 배너와 갤러리 광고는 전화 상담 후 계좌 입금으로 진행됩니다.
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
            <p style={{ ...textStyle.body, color: c.gray900, whiteSpace: 'pre-line' }}>{s.body}</p>
          </section>
        ))}
        <p style={{ ...textStyle.body, color: c.gray700 }}>
          상품별 노출 위치는{' '}
          <BizLink href="/advertising/products" style={{ color: c.primary }}>
            광고 상품 안내
          </BizLink>
          에서, 게재 기준은{' '}
          <BizLink href="/advertising" style={{ color: c.primary }}>
            광고 운영정책
          </BizLink>
          에서 확인할 수 있습니다.
        </p>
      </Stack>
    </Content>
  );
}
