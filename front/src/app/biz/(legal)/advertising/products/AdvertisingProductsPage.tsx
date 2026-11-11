'use client';

import { BizLink } from '@/components/biz/BizShell';
import { Content } from '@/components/common/UserShell';
import { Heading, Icon, Stack, Title } from '@/components/common/Primitives';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

// 다른 정보 페이지(LegalPageBody)와 동일한 문서형 구조: 제목 · 소개 · (불릿 제목 + 본문) 섹션.
const sections = [
  {
    heading: '홈 히어로 배너',
    body: [
      '노출 위치: 홈 상단 메인 배너',
      '서비스 첫 화면 상단에서 가장 먼저 보이는 대형 배너 상품입니다.',
      '홈 상단 캐러셀에 노출되며, 광고 이미지와 광고명을 등록합니다. 클릭 시 지정한 랜딩 페이지로 이동합니다.',
      '일 단위로 과금되며 현재 단가는 결제 화면에서 확인할 수 있습니다.',
    ],
  },
  {
    heading: '갤러리 노출',
    body: [
      '노출 위치: 홈 중간 이미지 영역',
      '콘텐츠를 탐색하는 이용자에게 이미지 중심으로 자연스럽게 노출되는 상품입니다.',
      '홈 중간 갤러리 영역에 노출되며, 광고 이미지와 광고명을 등록합니다. 클릭 시 지정한 랜딩 페이지로 이동합니다.',
      '일 단위로 과금되며 현재 단가는 결제 화면에서 확인할 수 있습니다.',
    ],
  },
  {
    heading: '신청 및 심사',
    body: [
      '광고 이미지 업로드 후 광고명과 선택 사항인 랜딩 링크를 등록합니다.',
      '노출 시작일과 종료일을 선택하면 선택한 일수만큼 광고비가 계산됩니다.',
      '결제와 광고 소재 심사가 완료된 뒤 계약 기간에 맞춰 노출이 시작됩니다.',
      '소재 심사는 허위·과장, 청소년 유해성, 저작권 침해 여부 등을 기준으로 진행됩니다.',
    ],
  },
  {
    heading: '노출 및 결제 안내',
    body: [
      '광고는 상품별 지정 위치에서 로테이션 방식으로 노출될 수 있습니다.',
      '광고비는 상품별 일 단가에 선택한 노출 일수를 곱해 계산합니다.',
      '광고 개시 전 취소 또는 심사 반려 시 환불 기준에 따라 처리됩니다.',
      '광고 개시 후 취소는 이미 제공된 노출 기간을 공제한 뒤 잔여 금액을 환불할 수 있습니다.',
    ],
  },
] as const;

export function AdvertisingProductsPage() {
  return (
    <Content>
      <Stack gap={24}>
        <Title style={{ fontSize: 32, fontWeight: 700, lineHeight: 'normal', color: c.gray900 }}>
          광고 상품 안내
        </Title>
        <p style={{ ...textStyle.body, color: c.gray700, whiteSpace: 'pre-wrap' }}>
          챌린지와 브랜드에 맞는 노출 상품을 선택해 보세요. 실제 결제 금액은 신청 시점의 서버 단가와
          선택한 광고 기간을 기준으로 계산됩니다.
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
          자세한 게재 기준과 환불 조건은{' '}
          <BizLink href="/advertising" style={{ color: c.primary }}>
            광고 운영정책
          </BizLink>
          에서 확인할 수 있습니다.
        </p>
      </Stack>
    </Content>
  );
}
