'use client';

import { useEffect, useState } from 'react';
import { adApi } from '@/lib/ad-api';
import {
  BizContent,
  SectionTitle,
  TableBox,
  TRow,
  PrimaryButton,
  useBizHref,
} from '@/components/biz/BizShell';

export function BizProfilePage() {
  const hrefOf = useBizHref();
  const [business, setBusiness] = useState<Awaited<ReturnType<typeof adApi.businesses.me>> | null>(
    null,
  );
  const [error, setError] = useState(false);
  useEffect(() => {
    void adApi.businesses
      .me()
      .then(setBusiness)
      .catch(() => setError(true));
  }, []);
  if (error)
    return (
      <BizContent>
        <p>기업 정보를 불러오지 못했습니다.</p>
      </BizContent>
    );
  if (!business)
    return (
      <BizContent>
        <p>기업 정보를 불러오는 중입니다.</p>
      </BizContent>
    );
  return (
    <BizContent>
      <SectionTitle>기업 프로필</SectionTitle>
      <TableBox>
        <TRow>
          <span>기업명</span>
          <strong>{business.name}</strong>
        </TRow>
        <TRow>
          <span>사업자등록번호</span>
          <strong>{business.registrationNumber}</strong>
        </TRow>
        <TRow>
          <span>주소</span>
          <span>{business.address ?? '등록되지 않음'}</span>
        </TRow>
        <TRow>
          <span>전화번호</span>
          <span>{business.phone ?? '등록되지 않음'}</span>
        </TRow>
        <TRow>
          <span>이메일</span>
          <span>{business.email ?? '등록되지 않음'}</span>
        </TRow>
      </TableBox>
      <PrimaryButton onClick={() => (window.location.href = hrefOf('/profile/edit'))}>
        프로필 수정
      </PrimaryButton>
    </BizContent>
  );
}
