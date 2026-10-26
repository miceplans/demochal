'use client';

import { ApiError, generated } from '@semochal/api-client';
import styled from '@emotion/styled';
import { UserShell, Content } from '@/components/common/UserShell';
import { LoadingState } from '@/components/common/LoadingState';
import { NotFound } from '@/components/common/NotFound';
import { Muted, Tag } from '@/components/common/Primitives';
import type { BadgeTone } from '@/components/ui/Badge';
import { BizOrgProfile } from '@/components/biz/BizOrgProfile';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

const verificationTone = (displayStatus?: string): BadgeTone =>
  displayStatus === '승인' ? 'green' : displayStatus === '반려' ? 'red' : 'amber';

interface IntroBlock {
  type?: string;
  content?: Record<string, unknown>;
}

// contentBlocks 편집기가 아직 없어 실제로는 빈 배열이지만, 저장된 블록이 있으면 읽기 전용으로 보여준다.
function IntroBlocks({ blocks }: { blocks?: readonly IntroBlock[] }) {
  if (!blocks?.length) return null;
  return (
    <Intro>
      <IntroTitle>소개</IntroTitle>
      {blocks.map((block, index) => {
        const content = block.content ?? {};
        if (block.type === 'text' && typeof content.text === 'string') {
          return <IntroText key={index}>{content.text}</IntroText>;
        }
        if (block.type === 'link' && typeof content.url === 'string') {
          const label = typeof content.label === 'string' ? content.label : content.url;
          return (
            <IntroLink key={index} href={content.url} target="_blank" rel="noreferrer">
              {label}
            </IntroLink>
          );
        }
        return null;
      })}
    </Intro>
  );
}

function LoadError() {
  return (
    <UserShell title="기업 프로필" back="/explore">
      <Content>
        <Muted role="alert">기업 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</Muted>
      </Content>
    </UserShell>
  );
}

export function PublicBusinessProfilePage({ businessId }: { businessId: string }) {
  const businessQuery = generated.useGetPublicBusiness(businessId);
  const business = businessQuery.data?.status === 200 ? businessQuery.data.data : undefined;
  if (businessQuery.isLoading) {
    return (
      <UserShell title="기업 프로필" back="/explore">
        <Content>
          <LoadingState label="기업 정보를 불러오는 중이에요" />
        </Content>
      </UserShell>
    );
  }
  if (businessQuery.isError) {
    const notFound = businessQuery.error instanceof ApiError && businessQuery.error.status === 404;
    if (notFound) return <NotFound homeHref="/explore" />;
    return <LoadError />;
  }
  // 비-2xx 응답은 ApiError로 throw되므로 data가 있으면 200이다. 타입 좁히기용 방어 분기다.
  if (!business) return <LoadError />;
  return (
    <UserShell title={business.name ?? '기업 프로필'} back="/explore">
      <Content style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <BizOrgProfile
          bannerUrl={business.bannerUrl ?? null}
          logoUrl={business.logoUrl ?? null}
          name={
            <NameWrap>
              <span>{business.name ?? '이름 없는 기업'}</span>
              {business.displayStatus ? (
                <Tag tone={verificationTone(business.displayStatus)}>{business.displayStatus}</Tag>
              ) : null}
            </NameWrap>
          }
          address={business.address}
          phone={business.phone}
          email={business.email}
        />
        <IntroBlocks blocks={business.contentBlocks} />
      </Content>
    </UserShell>
  );
}

const NameWrap = styled.span({ display: 'inline-flex', alignItems: 'center', gap: 8 });
const Intro = styled.section({ display: 'flex', flexDirection: 'column', gap: 12 });
const IntroTitle = styled.h2({ margin: 0, ...textStyle.h2, color: c.gray900 });
const IntroText = styled.p({
  margin: 0,
  ...textStyle.body,
  color: c.gray900,
  whiteSpace: 'pre-line',
});
const IntroLink = styled.a({
  ...textStyle.body,
  color: c.primary,
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
});
