import type { Metadata } from 'next';
import { AdInquiryPage } from './AdInquiryPage';

export const metadata: Metadata = {
  title: '광고 문의',
  description: '세모챌 광고 게재 문의 전화번호와 광고비 입금 계좌를 안내합니다.',
};

export default function Page() {
  return <AdInquiryPage />;
}
