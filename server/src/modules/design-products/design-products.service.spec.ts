import { describe, expect, it, vi } from 'vitest';
import { DesignProductsService } from './design-products.service.js';

function makeService() {
  const returning = vi.fn().mockResolvedValue([{ id: 'order-1', amount: 500_000 }]);
  const values = vi.fn().mockReturnValue({ returning });
  const db = { insert: vi.fn().mockReturnValue({ values }) };
  return { service: new DesignProductsService(db as never), values };
}

describe('DesignProductsService', () => {
  it('상품 목록은 서버 카탈로그 가격을 반환한다', () => {
    const { service } = makeService();
    expect(service.list().map((p) => [p.code, p.price])).toEqual([
      ['poster', 500_000],
      ['opening_video', 3_000_000],
    ]);
  });

  it('주문 금액은 카탈로그 가격으로 고정해 pending 주문을 만든다', async () => {
    const { service, values } = makeService();
    const order = await service.createOrder('poster', 'user-1');
    expect(values).toHaveBeenCalledWith({
      userId: 'user-1',
      designProduct: 'poster',
      amount: 500_000,
    });
    expect(order).toEqual({ id: 'order-1', amount: 500_000, name: '포스터 시안 제작' });
  });
});
