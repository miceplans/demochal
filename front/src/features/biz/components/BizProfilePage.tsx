'use client';

import { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { adApi } from '@/lib/ad-api';
import { BizOrgProfile } from '@/components/biz/BizOrgProfile';
import { BizContent, PrimaryButton, useBizHref } from '@/components/biz/BizShell';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

async function resolveFileUrl(fileId?: string | null): Promise<string | null> {
  if (!fileId) return null;
  try {
    return (await adApi.files.get(fileId)).url ?? null;
  } catch {
    return null;
  }
}

export function BizProfilePage() {
  const hrefOf = useBizHref();
  const authQuery = generated.useGetMyAuthInfo({ query: { retry: false } });
  const [business, setBusiness] = useState<Awaited<ReturnType<typeof adApi.businesses.me>> | null>(
    null,
  );
  const [images, setImages] = useState<{ banner: string | null; logo: string | null }>({
    banner: null,
    logo: null,
  });
  const [error, setError] = useState(false);
  useEffect(() => {
    void adApi.businesses
      .me()
      .then(async (me) => {
        setBusiness(me);
        const [banner, logo] = await Promise.all([
          resolveFileUrl(me.bannerImageFileId),
          resolveFileUrl(me.logoImageFileId),
        ]);
        setImages({ banner, logo });
      })
      .catch(() => setError(true));
  }, []);
  const user = authQuery.data?.status === 200 ? authQuery.data.data : null;

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
  const rows: [string, string | undefined][] = [
    ['성함', user?.name],
    ['소속', business.name],
    ['이메일', user?.email],
    ['전화번호', business.phone ?? undefined],
    ['아이디', user?.email?.split('@')[0]],
  ];
  return (
    <BizContent style={{ gap: 48 }}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Heading>나의 정보</Heading>
        <List>
          {rows.map(([label, value]) => (
            <Row key={label}>
              <Label>{label}</Label>
              <span>{value}</span>
            </Row>
          ))}
          <Row>
            <Label>비밀번호</Label>
            {/* TODO: 비밀번호 재설정 플로우 연결 (현재 API 없음) */}
            <ResetButton type="button">재설정</ResetButton>
          </Row>
          <Row style={{ alignItems: 'flex-start' }}>
            <Label>인증 서류</Label>
            <Document aria-hidden />
          </Row>
        </List>
      </section>
      <BizOrgProfile
        bannerUrl={images.banner}
        logoUrl={images.logo}
        name={business.name}
        address={business.address}
        phone={business.phone}
        email={business.email}
        action={
          <PrimaryButton
            style={{ marginTop: 70 }}
            onClick={() => (window.location.href = hrefOf('/profile/edit'))}
          >
            내 기업 프로필 수정하기
          </PrimaryButton>
        }
      />
    </BizContent>
  );
}

const Heading = styled.h1({ margin: 0, ...textStyle.h1_2, color: c.gray900 });
const List = styled.div({
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  overflow: 'hidden',
});
const Row = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  minHeight: 56,
  padding: '18px 16px',
  ...textStyle.bodyLarge,
  color: c.gray900,
  '& + &': { borderTop: `1px solid ${c.gray100}` },
});
const Label = styled.span({ width: 80, flexShrink: 0 });
const ResetButton = styled.button({
  width: 89,
  height: 37,
  border: 0,
  borderRadius: 6,
  background: c.primary,
  color: c.white,
  ...textStyle.subtitle,
});
// 사업자등록증 원본은 private 버킷 문서라 화면에는 흐림 처리된 자리표시만 둔다.
const Document = styled.div({
  width: 100,
  height: 144,
  background: c.gray100,
  filter: 'blur(1.2px)',
});
