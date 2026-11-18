import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BizDesignProductsPage } from '@/features/biz/components/BizDesignProductsPage';
import { isBzHostHeader } from '@/lib/biz';

export const metadata: Metadata = {
  title: '디자인 상품',
};

export default async function BizDesignProductsRoute() {
  // bz 호스트는 디자인 상품이 아닌 광고 상품을 판매한다 — 광고 관리로 보낸다.
  if (isBzHostHeader((await headers()).get('host'))) redirect('/ads');
  return <BizDesignProductsPage />;
}
