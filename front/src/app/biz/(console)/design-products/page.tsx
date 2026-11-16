import type { Metadata } from 'next';
import { BizDesignProductsPage } from '@/features/biz/components/BizDesignProductsPage';

export const metadata: Metadata = {
  title: '디자인 상품',
};

export default function BizDesignProductsRoute() {
  return <BizDesignProductsPage />;
}
