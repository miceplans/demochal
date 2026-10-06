'use client';

import Link from 'next/link';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

const Page = styled.div({
  minHeight: '100svh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: c.white,
});
const Inner = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 64,
  padding: '48px 24px',
});
const Image = styled.img({ width: 142, height: 'auto', display: 'block' });
const Message = styled.p({
  ...textStyle.bodyLarge,
  lineHeight: 1.4,
  color: c.gray900,
  textAlign: 'center',
  whiteSpace: 'pre-line',
  marginTop: 4,
});
const HomeLink = styled(Link)({
  ...textStyle.bodyLarge,
  fontWeight: 600,
  lineHeight: 1.4,
  background: c.primary,
  color: c.white,
  borderRadius: 8,
  padding: '11px 16px',
  textDecoration: 'none',
});

export function NotFound({
  homeHref = '/',
  buttonText = '홈으로',
}: {
  homeHref?: string;
  buttonText?: string;
}) {
  return (
    <Page>
      <Inner>
        <div>
          <Image src="/assets/404.png" alt="404" width={598} height={228} />
          <Message>{'앗, 여긴 아무것도 없어요. \n홈으로 돌아가실래요?'}</Message>
        </div>
        <HomeLink href={homeHref}>{buttonText}</HomeLink>
      </Inner>
    </Page>
  );
}
