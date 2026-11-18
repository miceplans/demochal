'use client';

import { Content } from '@/components/common/UserShell';
import { Stack, Title } from '@/components/common/Primitives';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

export function SubscriptionProductsPage() {
  return (
    <Content>
      <Stack gap={24}>
        <Title style={{ fontSize: 32, fontWeight: 700, lineHeight: 'normal', color: c.gray900 }}>
          구독 상품 안내
        </Title>
        <p style={{ ...textStyle.body, color: c.gray700 }}>
          구독 상품을 준비하고 있습니다. 상품 구성과 이용 요금은 확정되는 대로 안내하겠습니다.
        </p>
      </Stack>
    </Content>
  );
}
