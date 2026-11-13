'use client';

import { useState } from 'react';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { BizContent, PrimaryButton, SectionTitle } from '@/components/biz/BizShell';
import { LoadingState } from '@/components/common/LoadingState';
import { useToast } from '@/components/common/Toast';
import { requestTossPayment } from '@/lib/payments';
import { apiErrorMessage } from '@/lib/api-error';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

export function BizDesignProductsPage() {
  const toast = useToast();
  const productsQuery = generated.useListDesignProducts();
  const createOrder = generated.useCreateDesignProductOrder();
  const cancelOrder = generated.useCancelOrder();
  const [buyingCode, setBuyingCode] = useState<string | null>(null);
  const products = productsQuery.data?.status === 200 ? productsQuery.data.data : [];

  const buy = async (code: 'poster' | 'opening_video') => {
    if (buyingCode) return;
    setBuyingCode(code);
    try {
      const created = await createOrder.mutateAsync({ data: { productCode: code } });
      if (created.status !== 201) throw new Error('예상하지 못한 응답입니다.');
      const order = created.data;
      try {
        const started = await requestTossPayment({
          orderId: order.id,
          amount: order.amount,
          orderName: order.name,
          flow: 'design',
        });
        if (!started)
          throw new Error('결제창을 열 수 없습니다. Toss 클라이언트 키 설정을 확인해 주세요.');
      } catch (error) {
        // 결제창 진입에 실패하면 남는 pending 주문을 정리한다.
        await cancelOrder.mutateAsync({ id: order.id }).catch(() => {});
        throw error;
      }
    } catch (error) {
      toast.error('주문에 실패했습니다', apiErrorMessage(error, '잠시 후 다시 시도해 주세요.'));
    } finally {
      setBuyingCode(null);
    }
  };

  return (
    <BizContent>
      <SectionTitle>디자인 상품</SectionTitle>
      {productsQuery.isPending && <LoadingState label="디자인 상품을 불러오는 중" />}
      <List aria-label="디자인 상품 목록">
        {products.map((p) => (
          <Card key={p.code}>
            <Name>{p.name}</Name>
            <Desc>{p.description}</Desc>
            <Price>{p.price.toLocaleString()}원</Price>
            <PrimaryButton
              type="button"
              disabled={buyingCode !== null}
              onClick={() => void buy(p.code)}
            >
              {buyingCode === p.code ? '결제창 여는 중…' : '구매하기'}
            </PrimaryButton>
          </Card>
        ))}
      </List>
    </BizContent>
  );
}

const List = styled.div({ display: 'flex', flexWrap: 'wrap', gap: 24 });
const Card = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  width: 320,
  maxWidth: '100%',
  padding: 24,
  border: `1px solid ${c.gray200}`,
  borderRadius: 8,
});
const Name = styled.p({ ...textStyle.h3_2, color: c.gray900 });
const Desc = styled.p({ ...textStyle.body, color: c.gray700, flex: 1 });
const Price = styled.p({ ...textStyle.h2_2, color: c.primary });
