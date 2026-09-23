'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { useToast } from '@/components/common/Toast';
import {
  AdminInlineNotice,
  AdminPageTitle,
  AdminTable,
  Badge,
  FilterBar,
  SearchFilter,
  SelectFilter,
  type AdminColumn,
} from './parts';
import { useAdminHref } from './AdminShell';

const Page = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  width: '100%',
  margin: '0 auto',
  maxWidth: 1220,
});
const Preview = styled.div({
  position: 'relative',
  width: '100%',
  height: 495,
  overflow: 'hidden',
});
const PricingLink = styled(Link)({
  position: 'absolute',
  zIndex: 1,
  top: 83,
  left: 561,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 98,
  height: 37,
  borderRadius: 6,
  padding: '10px 12px',
  background: c.primary,
  color: c.white,
  textDecoration: 'none',
});

type AdRow = {
  id: string;
  location: string;
  title: string;
  price: string;
  status: string;
  rawStatus: string;
};

const statusOptionToParam: Record<string, 'active' | 'preparing' | 'paused' | 'ended'> = {
  진행중: 'active',
  준비중: 'preparing',
  중단: 'paused',
  종료: 'ended',
};
const statusLabelOf: Record<string, string> = {
  active: '진행중',
  preparing: '준비중',
  paused: '중단',
  ended: '종료',
};
const statusToneOf: Record<string, 'blue' | 'green' | 'gray' | 'red'> = {
  active: 'blue',
  preparing: 'gray',
  paused: 'red',
  ended: 'green',
};

const formatPrice = (amount: number) => `${amount.toLocaleString('ko-KR')}원`;

export function AdminAdsScreen() {
  const [query, setQuery] = useState('');
  const [statusLabel, setStatusLabel] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const toast = useToast();
  const hrefOf = useAdminHref();

  const adsQuery = generated.useListAdminAds({
    q: query || undefined,
    status: statusOptionToParam[statusLabel],
  });
  const refetchAds = adsQuery.refetch;

  useEffect(() => {
    if (!adsQuery.isError) return;
    toast.error('광고 목록을 불러올 수 없어요. 잠시 후 다시 시도해주세요.', undefined, {
      action: { label: '다시 시도', onClick: () => void refetchAds() },
    });
  }, [adsQuery.isError, refetchAds, toast]);

  const rows = useMemo<AdRow[]>(
    () =>
      (adsQuery.data?.data ?? []).map((ad) => ({
        id: ad.id ?? '',
        location: ad.productName || ad.productId || '',
        title: ad.title ?? '',
        price: formatPrice(ad.paidAmount ?? 0),
        status: statusLabelOf[ad.status ?? ''] ?? ad.status ?? '',
        rawStatus: ad.status ?? '',
      })),
    [adsQuery.data],
  );
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  const pauseMutation = generated.useUpdateAd({
    mutation: {
      onSuccess: () => {
        toast.success('광고를 중단했어요.');
        setSelectedId(null);
        adsQuery.refetch();
      },
      onError: () => toast.error('광고 중단에 실패했어요', '잠시 후 다시 시도해주세요'),
    },
  });

  const handleActivity = (value: string) => {
    if (value !== '광고 중단하기') return;
    if (pauseMutation.isPending) return;
    if (!selected) {
      toast.error('광고를 먼저 선택해주세요', '목록에서 중단할 광고 행을 클릭해주세요');
      return;
    }
    if (selected.rawStatus !== 'active') {
      toast.error('진행중인 광고만 중단할 수 있어요');
      return;
    }
    pauseMutation.mutate({ id: selected.id, data: { status: 'paused' } });
  };

  const columns: AdminColumn<AdRow>[] = [
    { key: 'location', header: '위치', width: 180 },
    { key: 'title', header: '제목', width: 220 },
    { key: 'price', header: '금액', width: 140 },
    {
      key: 'status',
      header: '상태',
      width: 100,
      render: (row) => <Badge tone={statusToneOf[row.rawStatus] ?? 'gray'}>{row.status}</Badge>,
    },
  ];

  return (
    <Page>
      <AdminPageTitle>광고 관리</AdminPageTitle>
      <FilterBar>
        <SearchFilter
          placeholder="광고명/기관명 검색"
          label="광고명 또는 기관명 검색"
          value={query}
          onChange={setQuery}
        />
        <SelectFilter
          label="상태"
          options={['진행중', '준비중', '중단', '종료']}
          value={statusLabel}
          onChange={setStatusLabel}
        />
        <SelectFilter label="활동" options={['광고 중단하기']} onChange={handleActivity} />
      </FilterBar>
      {adsQuery.isPending ? (
        <AdminInlineNotice>불러오는 중...</AdminInlineNotice>
      ) : adsQuery.isError ? null : rows.length === 0 ? (
        <AdminInlineNotice>조건에 맞는 광고가 없어요.</AdminInlineNotice>
      ) : (
        <AdminTable
          columns={columns}
          rows={rows}
          onRowClick={(row) => setSelectedId((current) => (current === row.id ? null : row.id))}
          selectedRowId={selectedId}
        />
      )}
      <Preview>
        <Image
          src="/assets/ads-priview.png"
          alt="광고 노출 미리보기"
          fill
          priority
          sizes="1220px"
          style={{ objectFit: 'cover' }}
        />
        <PricingLink href={hrefOf('/ad-pricing/pricing')}>광고비 관리</PricingLink>
      </Preview>
    </Page>
  );
}
