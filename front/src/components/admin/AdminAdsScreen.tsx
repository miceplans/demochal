'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { useToast } from '@/components/common/Toast';
import { SearchFilter, SelectFilter } from './parts';

const Page = styled.div({ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', margin: '48px 20px 0', maxWidth: 1220 });
const Header = styled.div({ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, width: 1100 });
const Title = styled.h1({ margin: '4px 0 0', color: c.gray900, ...textStyle.h1_2 });
const Filters = styled.div({ display: 'flex', alignItems: 'flex-start', gap: 16 });
const Dropdowns = styled.div({ display: 'flex', gap: 10 });
const Table = styled.div({ width: 1100, border: '1px solid #DFE2E7', borderRadius: 12, overflow: 'hidden', background: c.white });
const TableRow = styled.div<{ header?: boolean }>(({ header }) => ({
  display: 'grid', gridTemplateColumns: '180px 180px 180px minmax(80px, 1fr)', alignItems: 'center', gap: 16,
  height: header ? 52 : 56, padding: '0 16px', borderTop: header ? 0 : '1px solid #DFE2E7',
  background: header ? c.gray100 : c.white, color: c.gray900, ...(header ? textStyle.h3_2 : textStyle.bodyLarge),
}));
const Progress = styled.span({ color: c.primary, ...textStyle.body });
const Preview = styled.div({ position: 'relative', width: 1220, height: 495, overflow: 'hidden' });
const PricingLink = styled(Link)({ position: 'absolute', zIndex: 1, top: 83, left: 561, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 98, height: 37, borderRadius: 6, padding: '10px 12px', background: c.primary, color: c.white, textDecoration: 'none', ...textStyle.subtitle });

const ads = [
  { id: '1', location: '상단 빅배너 1', title: '한국 IT 공모전', price: '100,000원', status: '진행중' },
  { id: '2', location: '상단 빅배너 2', title: '한국 IT 공모전', price: '100,000원', status: '진행중' },
  { id: '3', location: '상단 빅배너 3', title: '한국 IT 공모전', price: '100,000원', status: '진행중' },
  { id: '4', location: '상단 빅배너 4', title: '한국 IT 공모전', price: '100,000원', status: '진행중' },
  { id: '5', location: '상단 빅배너 5', title: '한국 IT 공모전', price: '100,000원', status: '진행중' },
];

export function AdminAdsScreen() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const toast = useToast();
  const rows = useMemo(() => ads.filter((ad) => `${ad.location} ${ad.title}`.includes(query) && (!status || ad.status === status)), [query, status]);
  const handleActivity = (value: string) => {
    const label = value === '광고 수정하기' ? value : value === '내보내기' ? value : '광고 중단하기';
    toast.success(label, '선택한 광고에 적용할 수 있습니다.');
  };

  return (
    <Page>
      <Header>
        <Title>광고 관리</Title>
        <Filters>
          <SearchFilter placeholder="기관명/담당자 검색" label="기관명 또는 담당자 검색" value={query} onChange={setQuery} />
          <Dropdowns>
            <SelectFilter label="상태" options={['진행중', '종료']} value={status} onChange={setStatus} />
            <SelectFilter label="활동" options={['광고 수정하기', '내보내기', '광고 중단하기']} onChange={handleActivity} />
          </Dropdowns>
        </Filters>
      </Header>
      <Table role="table" aria-label="광고 관리 목록">
        <TableRow header role="row"><span role="columnheader">위치</span><span role="columnheader">제목</span><span role="columnheader">금액</span><span role="columnheader">상태</span></TableRow>
        {rows.map((ad) => <TableRow key={ad.id} role="row"><span role="cell">{ad.location}</span><span role="cell">{ad.title}</span><span role="cell">{ad.price}</span><Progress role="cell">{ad.status}</Progress></TableRow>)}
      </Table>
      <Preview>
        <Image src="/ads-priview.png" alt="광고 노출 미리보기" fill priority sizes="1220px" style={{ objectFit: 'cover' }} />
        <PricingLink href="/admin/ad-pricing/pricing">광고비 관리</PricingLink>
      </Preview>
    </Page>
  );
}
