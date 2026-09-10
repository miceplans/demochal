'use client';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  BizContent,
  SectionTitle,
  TableBox,
  TRow,
  PrimaryButton,
  OutlineButton,
  useBizHref,
} from '@/components/biz/BizShell';
import { admin, orgProfile } from '@/data/biz-design';
import { maskEmail, maskPhone } from '@/lib/mask';
import { MaskedText } from '@/components/ui/MaskedText';

const OrgCard = styled.div({
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  padding: 32,
  display: 'flex',
  gap: 32,
  alignItems: 'center',
  background: `linear-gradient(180deg, transparent 55%, ${c.gray900})`,
  position: 'relative',
  overflow: 'hidden',
});
const OrgThumb = styled.div({
  width: 159,
  height: 159,
  borderRadius: 15,
  background: c.gray100,
  flexShrink: 0,
});
const OrgMeta = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  color: c.white,
  position: 'relative',
});
const OrgName = styled.strong(textStyle.display);
const OrgRow = styled.span({ display: 'flex', alignItems: 'center', gap: 8, ...textStyle.body });
const Actions = styled.div({ display: 'flex', justifyContent: 'center' });

export function BizProfilePage() {
  const router = useRouter();
  const hrefOf = useBizHref();
  return (
    <BizContent>
      <section aria-label="나의 정보">
        <SectionTitle>나의 정보</SectionTitle>
        <TableBox style={{ marginTop: 16 }}>
          <TRow>
            <span>성함</span>
            <strong>{admin.name}</strong>
          </TRow>
          <TRow>
            <span>소속</span>
            <strong>{admin.company}</strong>
          </TRow>
          <TRow>
            <span>이메일</span>
            <strong><MaskedText value={admin.email} masked={maskEmail(admin.email)} /></strong>
          </TRow>
          <TRow>
            <span>전화번호</span>
            <strong><MaskedText value={admin.phone} masked={maskPhone(admin.phone)} /></strong>
          </TRow>
          <TRow>
            <span>아이디</span>
            <strong>{admin.id}</strong>
          </TRow>
          <TRow>
            <span>비밀번호</span>
            <OutlineButton type="button">재설정</OutlineButton>
          </TRow>
          <TRow>
            <span>인증 서류</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span
                aria-hidden
                style={{
                  width: 100,
                  height: 60,
                  borderRadius: 8,
                  background: `linear-gradient(120deg, ${c.gray100}, ${c.gray200})`,
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: 12, color: c.gray500 }}>사업자등록증</span>
            </span>
          </TRow>
        </TableBox>
      </section>
      <section aria-label="내 기업 프로필">
        <SectionTitle>내 기업 프로필</SectionTitle>
        <OrgCard style={{ marginTop: 16 }}>
          <OrgThumb aria-hidden />
          <OrgMeta>
            <OrgName>{orgProfile.name}</OrgName>
            <OrgRow>{orgProfile.address}</OrgRow>
            <OrgRow><MaskedText value={orgProfile.phone} masked={maskPhone(orgProfile.phone)} /></OrgRow>
            <OrgRow><MaskedText value={orgProfile.email} masked={maskEmail(orgProfile.email)} /></OrgRow>
          </OrgMeta>
        </OrgCard>
        <Actions style={{ marginTop: 24 }}>
          <PrimaryButton onClick={() => router.push(hrefOf('/profile/edit'))}>
            내 기업 프로필 수정하기
          </PrimaryButton>
        </Actions>
      </section>
    </BizContent>
  );
}
