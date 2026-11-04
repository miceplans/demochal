import type { Metadata } from 'next';
import { AdvertisingProductsPage } from './AdvertisingProductsPage';

export const metadata: Metadata = {
  title: '광고 상품 안내',
  description: 'SEMO.BIZ 광고 상품의 노출 위치, 제공 범위와 신청 절차를 안내합니다.',
};

export default function Page() {
  return <AdvertisingProductsPage />;
}
