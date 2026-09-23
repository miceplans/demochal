'use client';

import { useEffect, useState } from 'react';
import type { AdReport } from '@semochal/api-client';
import { adApi } from '@/lib/ad-api';
import { BizContent, SectionTitle, TableBox, THead, TRow } from '@/components/biz/BizShell';

export function BizReportsPage() {
  const [report, setReport] = useState<AdReport | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    void adApi.ads
      .listMine('active')
      .then(async (ads) => {
        if (ads[0]) setReport(await adApi.ads.getReport(ads[0].id));
      })
      .catch(() => setError(true));
  }, []);
  if (error)
    return (
      <BizContent>
        <p>성과 리포트를 불러오지 못했습니다.</p>
      </BizContent>
    );
  if (!report)
    return (
      <BizContent>
        <SectionTitle>성과 리포트</SectionTitle>
        <p>활성 광고의 성과 데이터가 없습니다.</p>
      </BizContent>
    );
  return (
    <BizContent>
      <SectionTitle>성과 리포트</SectionTitle>
      <TableBox>
        <THead>
          <span>날짜</span>
          <span>노출</span>
          <span>클릭</span>
          <span>클릭률</span>
        </THead>
        {report.daily.map((row) => (
          <TRow key={row.date}>
            <span>{row.date}</span>
            <span>{row.impressions.toLocaleString()}</span>
            <span>{row.clicks.toLocaleString()}</span>
            <span>{row.ctr.toFixed(1)}%</span>
          </TRow>
        ))}
      </TableBox>
    </BizContent>
  );
}
