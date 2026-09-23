'use client';

import { useEffect, useState } from 'react';
import type { BizDashboard } from '@semochal/api-client';
import { adApi } from '@/lib/ad-api';
import { BizContent, SectionTitle, TableBox, TRow } from '@/components/biz/BizShell';

export function BizDashboardPage() {
  const [data, setData] = useState<BizDashboard | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    void adApi.billing
      .getBizDashboard()
      .then(setData)
      .catch(() => setError(true));
  }, []);
  if (error)
    return (
      <BizContent>
        <p>대시보드 데이터를 불러오지 못했습니다.</p>
      </BizContent>
    );
  if (!data)
    return (
      <BizContent>
        <p>대시보드를 불러오는 중입니다.</p>
      </BizContent>
    );
  return (
    <BizContent>
      <SectionTitle>대시보드</SectionTitle>
      <TableBox>
        <TRow>
          <span>최근 공고</span>
          <strong>{data.recentPosting?.title ?? '등록된 공고 없음'}</strong>
        </TRow>
        <TRow>
          <span>공고 조회수</span>
          <strong>{data.stats?.clicks.value ?? 0}</strong>
        </TRow>
        <TRow>
          <span>북마크</span>
          <strong>{data.stats?.bookmarks.value ?? 0}</strong>
        </TRow>
        <TRow>
          <span>결제 합계</span>
          <strong>{data.paymentTotal.toLocaleString()}원</strong>
        </TRow>
        <TRow>
          <span>진행중 광고</span>
          <strong>{data.activeAds.length}건</strong>
        </TRow>
      </TableBox>
    </BizContent>
  );
}
