'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Ad, AdReport } from '@semochal/api-client';
import { adApi } from '@/lib/ad-api';
import {
  BizContent,
  SectionTitle,
  TableBox,
  THead,
  TRow,
  FieldSelect,
  useBizHref,
} from '@/components/biz/BizShell';

export function BizReportsPage() {
  const router = useRouter();
  const hrefOf = useBizHref();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('adId');
  const [ads, setAds] = useState<Ad[]>([]);
  const [selectedId, setSelectedId] = useState(requestedId ?? '');
  const [report, setReport] = useState<AdReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    void adApi.ads
      .listMine()
      .then((items) => {
        setAds(items);
        const id =
          requestedId && items.some((item) => item.id === requestedId)
            ? requestedId
            : (items[0]?.id ?? '');
        setSelectedId(id);
        if (!id) return;
        return adApi.ads.getReport(id).then(setReport);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [requestedId]);

  const selectAd = (id: string) => {
    setSelectedId(id);
    router.replace(hrefOf(`/reports?adId=${encodeURIComponent(id)}`));
  };
  if (loading)
    return (
      <BizContent>
        <SectionTitle>성과 리포트</SectionTitle>
        <p>리포트를 불러오는 중입니다.</p>
      </BizContent>
    );
  if (error)
    return (
      <BizContent>
        <SectionTitle>성과 리포트</SectionTitle>
        <p>성과 리포트를 불러오지 못했습니다.</p>
      </BizContent>
    );
  if (!report || !selectedId)
    return (
      <BizContent>
        <SectionTitle>성과 리포트</SectionTitle>
        <p>조회할 광고 성과 데이터가 없습니다.</p>
      </BizContent>
    );
  return (
    <BizContent>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionTitle>성과 리포트</SectionTitle>
        <FieldSelect
          aria-label="광고 선택"
          value={selectedId}
          onChange={(event) => selectAd(event.target.value)}
        >
          {ads.map((ad) => (
            <option key={ad.id} value={ad.id}>
              {ad.title}
            </option>
          ))}
        </FieldSelect>
      </div>
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
