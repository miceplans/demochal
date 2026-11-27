'use client';
import styled from '@emotion/styled';
import { UserShell, Content } from '@/components/common/UserShell';
import { Stack, Title, Heading, Icon } from '@/components/common/Primitives';
import legalCopy from '@/data/design-copy.json';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { buildLegalSections } from '../Mypage';

export function LegalPageBody({
  kind,
}: {
  kind: 'privacy' | 'terms' | 'youth-protection' | 'advertising-policy' | 'refund-policy';
}) {
  const paragraphs =
    kind === 'privacy'
      ? (legalCopy as { privacy: string[] }).privacy
      : kind === 'youth-protection'
        ? (legalCopy as { youthProtection: string[] }).youthProtection
        : kind === 'advertising-policy'
          ? (legalCopy as { advertisingPolicy: string[] }).advertisingPolicy
          : kind === 'refund-policy'
            ? (legalCopy as { refundPolicy: string[] }).refundPolicy
            : (legalCopy as { terms: string[] }).terms;
  // Data shape: [title, intro, heading, body?, heading, body?, ...] — a heading
  // (조/장) isn't always followed by a body: chapter dividers like "제1장 총칙"
  // sit directly before the next heading with no body of their own.
  const [title, intro, ...articles] = paragraphs;
  const sections = buildLegalSections(articles);
  return (
    <Content>
      <Stack gap={24}>
        <LegalTitle>{title}</LegalTitle>
        <LegalIntro>{intro}</LegalIntro>
        {sections.map((s, i) => (
          <section key={i}>
            <LegalHeading chapter={s.isChapter}>
              {!s.isChapter && (
                <Icon src="/assets/icons/bullet-icon.png" width={8} height={23} alt="" />
              )}
              {s.heading}
            </LegalHeading>
            {s.body && <LegalBody>{s.body}</LegalBody>}
          </section>
        ))}
      </Stack>
    </Content>
  );
}

export function LegalPage({
  kind,
}: {
  kind: 'privacy' | 'terms' | 'youth-protection' | 'advertising-policy' | 'refund-policy';
}) {
  return (
    <UserShell
      title={
        kind === 'privacy'
          ? '개인정보처리방침'
          : kind === 'youth-protection'
            ? '청소년 보호 정책'
            : kind === 'advertising-policy'
              ? '광고 운영 정책'
              : kind === 'refund-policy'
                ? '환불 정책'
                : '이용약관'
      }
    >
      <LegalPageBody kind={kind} />
    </UserShell>
  );
}

// Styles are kept together at the bottom so page behavior and layout definitions remain separate.
const LegalTitle = styled(Title)({
  fontSize: 32,
  fontWeight: 700,
  lineHeight: 'normal',
  color: c.gray900,
});
const LegalIntro = styled.p({ ...textStyle.body, color: c.gray700, whiteSpace: 'pre-wrap' });
const LegalHeading = styled(Heading)<{ chapter: boolean }>(({ chapter }) => ({
  ...textStyle.h1_2,
  color: c.gray900,
  marginBottom: 8,
  display: 'flex',
  alignItems: 'center',
  gap: chapter ? 0 : 12,
}));
const LegalBody = styled.p({ ...textStyle.body, color: c.gray900, whiteSpace: 'pre-line' });
