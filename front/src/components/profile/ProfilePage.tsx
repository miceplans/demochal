'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { UserShell, Content } from '@/components/common/UserShell';
import { Button, Icon, Muted, Row, Stack, Tag, Wrap } from '@/components/common/Primitives';
import { ScoutModal } from '@/components/people/ScoutModal';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import type { ProfileAward, ProfileUserData } from './ProfileCards';
import { isGithubUrl, isSafeLinkUrl, linkDisplayText, linkIconName } from './link-model';

// 사람 카드와 같은 규칙: 링크·수상 이력에서 인증 배지를 도출하고, 저장된 badges와 합쳐 중복을 없앤다.
function verificationBadges(user: ProfileUserData) {
  const links = (user.externalLinks ?? []).filter((link) => isSafeLinkUrl(link.url));
  const derived: { label: string; icon: string; tone: 'gray' | 'blue' | 'green' }[] = [];
  if (links.some((link) => isGithubUrl(link.url)))
    derived.push({ label: '깃허브 인증', icon: 'imgGithub', tone: 'gray' });
  if (links.some((link) => !isGithubUrl(link.url)))
    derived.push({
      label: '포트폴리오',
      icon: 'imgDescription24DpE3E3E3Fill0Wght300Grad0Opsz241',
      tone: 'blue',
    });
  if ((user.awardHistory ?? []).length > 0)
    derived.push({
      label: '출품이력',
      icon: 'imgTrophy24DpE3E3E3Fill0Wght300Grad0Opsz241',
      tone: 'green',
    });
  const known = new Set(derived.map((badge) => badge.label));
  const extra = (user.badges ?? [])
    .filter((label) => !known.has(label))
    .map((label) => ({ label, icon: 'imgCertificate', tone: 'gray' as const }));
  return [...derived, ...extra];
}

function ProfilePageContent() {
  const searchParams = useSearchParams();
  // /profile?id=<uuid> — id가 없으면 로그인한 본인 프로필을 본다.
  const paramId = searchParams.get('id');
  const auth = generated.useGetMyAuthInfo({ query: { retry: false } });
  const me = auth.data?.status === 200 ? auth.data.data : undefined;
  const userId = paramId ?? me?.id ?? '';
  const userQuery = generated.useGetUser(userId, {
    query: { enabled: Boolean(userId), retry: false },
  });
  const user = userQuery.data?.status === 200 ? userQuery.data.data : undefined;

  // '팀에 초대'는 스카우트 모달(팀 선택·메시지·잔여 횟수)을 연다. 팀장인 팀이 없으면 버튼을 숨긴다.
  const managedQuery = generated.useListManagedTeams();
  const hasManagedTeam =
    managedQuery.data?.status === 200 && (managedQuery.data.data ?? []).length > 0;
  const [scoutOpen, setScoutOpen] = useState(false);
  const canInvite = Boolean(me) && userId !== me?.id && hasManagedTeam;

  if (!paramId && auth.isPending) {
    return (
      <UserShell title="프로필" compact>
        <Content />
      </UserShell>
    );
  }
  if (userQuery.isPending) {
    return (
      <UserShell title="프로필" compact>
        <Content />
      </UserShell>
    );
  }
  if (!user) {
    return (
      <UserShell title="프로필" compact>
        <Content>
          <Muted>프로필을 찾을 수 없어요.</Muted>
        </Content>
      </UserShell>
    );
  }

  const links = (user.externalLinks ?? []).filter((link) => isSafeLinkUrl(link.url));
  const stacks = user.stacks ?? [];
  const awards = user.awardHistory ?? [];
  const badges = verificationBadges(user);

  return (
    <UserShell title="프로필" compact>
      <Content>
        <Grid>
          <ProfileCard>
            <Row gap={16}>
              <Avatar aria-hidden />
              <Name>{user.name ?? '이름 없음'}</Name>
            </Row>
            {user.bio ? <Bio>{user.bio}</Bio> : null}
            {badges.length > 0 && (
              <Wrap style={{ gap: 8 }}>
                {badges.map((badge) => (
                  <ProfileBadge key={badge.label} tone={badge.tone}>
                    <Icon name={badge.icon} size={12} />
                    {badge.label}
                  </ProfileBadge>
                ))}
              </Wrap>
            )}
            <Divider />
            <Stack gap={12}>
              <SectionLabel>외부 링크</SectionLabel>
              {links.length === 0 ? (
                <Muted>등록된 외부 링크가 없어요.</Muted>
              ) : (
                links.map((link) => (
                  <LinkRow
                    key={link.url ?? link.label}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name={linkIconName(link.url)} size={16} />
                    <span>{linkDisplayText(link)}</span>
                  </LinkRow>
                ))
              )}
            </Stack>
            {canInvite && (
              <>
                <Divider />
                <Button onClick={() => setScoutOpen(true)} style={{ width: '100%' }}>
                  팀에 초대
                </Button>
              </>
            )}
          </ProfileCard>
          <Stack gap={28}>
            <Section>
              <SectionTitle>기술 스택</SectionTitle>
              {stacks.length === 0 ? (
                <Muted>등록된 기술 스택이 없어요.</Muted>
              ) : (
                <Wrap style={{ gap: 8 }}>
                  {stacks.map((stack) => (
                    <StackChip key={stack}>{stack}</StackChip>
                  ))}
                </Wrap>
              )}
            </Section>
            <Section style={{ gap: 16 }}>
              <SectionTitle>출품 / 수상 이력</SectionTitle>
              {awards.length === 0 ? (
                <Muted>등록된 수상 이력이 없어요.</Muted>
              ) : (
                awards.map((award, index) => (
                  <AwardCard key={`${award.title ?? '수상'}·${index}`} award={award} />
                ))
              )}
            </Section>
          </Stack>
        </Grid>
      </Content>
      <ScoutModal person={scoutOpen ? { id: userId } : null} onClose={() => setScoutOpen(false)} />
    </UserShell>
  );
}

function AwardCard({ award }: { award: ProfileAward }) {
  const meta = [award.organization, award.date].filter(Boolean).join(' · ');
  return (
    <HistoryCard>
      <Thumb aria-hidden />
      <Stack gap={4} style={{ flex: 1 }}>
        <CardTitle>{award.title ?? '수상 이력'}</CardTitle>
        <Row gap={8}>
          {award.prize ? (
            <Tag tone={award.prize === '대상' ? 'blue' : 'gray'}>{award.prize}</Tag>
          ) : null}
          {meta ? <Info>{meta}</Info> : null}
        </Row>
      </Stack>
    </HistoryCard>
  );
}

export function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfilePageContent />
    </Suspense>
  );
}

const Grid = styled.div({
  display: 'grid',
  gridTemplateColumns: '320px minmax(0,1fr)',
  gap: 32,
  alignItems: 'start',
  [mobile]: { display: 'flex', flexDirection: 'column', gap: 32 },
});
const ProfileCard = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  padding: 24,
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 12,
  background: c.white,
  [mobile]: { border: 0, padding: 0 },
});
const Avatar = styled.div({
  width: 64,
  height: 64,
  flexShrink: 0,
  borderRadius: '50%',
  background: c.gray100,
});
const Name = styled.p({ ...textStyle.subtitle2, color: c.gray900, lineHeight: 'normal' });
const ProfileBadge = styled(Tag)({ padding: '4px 10px', borderRadius: 8, lineHeight: 'normal' });
const Divider = styled.hr({
  width: '100%',
  height: 1,
  margin: 0,
  border: 0,
  background: c.gray100,
});
const Bio = styled.p({ ...textStyle.finePrint2, color: c.gray700, lineHeight: 'normal' });
const SectionLabel = styled.p({ ...textStyle.subtitle, color: c.gray900 });
const LinkRow = styled.a({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  ...textStyle.finePrint2,
  color: c.gray700,
  '& span': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  '&:hover': { color: c.gray900 },
});
const Section = styled.section({ display: 'flex', flexDirection: 'column', gap: 12 });
const SectionTitle = styled.h2({ ...textStyle.h3_2, color: c.gray900, lineHeight: 'normal' });
const StackChip = styled.span({
  ...textStyle.finePrint2,
  borderRadius: 20,
  padding: '6px 14px',
  background: c.gray100,
  color: c.gray900,
});
const HistoryCard = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: 16,
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 12,
});
const Thumb = styled.div({
  width: 80,
  height: 60,
  flexShrink: 0,
  borderRadius: 8,
  background: c.gray100,
});
const CardTitle = styled.p({ ...textStyle.buttonLabel, fontWeight: 600, color: c.gray900 });
const Info = styled.span({ ...textStyle.caption, color: c.gray500 });
