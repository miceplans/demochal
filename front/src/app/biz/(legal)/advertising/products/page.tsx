import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { isBzHostHeader } from '@/lib/biz';
import { AdvertisingProductsPage } from './AdvertisingProductsPage';
import { SubscriptionProductsPage } from './SubscriptionProductsPage';

// 같은 경로를 호스트별로 다른 문서로 서비스한다: bz = 광고형 상품, biz = 구독형 상품.
async function isBzHost() {
  return isBzHostHeader((await headers()).get('host'));
}

export async function generateMetadata(): Promise<Metadata> {
  if (await isBzHost()) {
    return {
      title: '광고 상품 안내',
      description: 'SEMO.BIZ 광고 상품의 노출 위치, 제공 범위와 신청 절차를 안내합니다.',
    };
  }
  return {
    title: '구독 상품 안내',
    description: 'SEMO.BIZ 구독형 상품의 구성과 이용 방법을 안내합니다.',
  };
}

export default async function Page() {
  return (await isBzHost()) ? <AdvertisingProductsPage /> : <SubscriptionProductsPage />;
}
