'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { UserShell, Content } from '@/components/common/UserShell';
import { Button, Heading, Stack, Icon, Row, Muted } from '@/components/common/Primitives';
import { Badges, Identity, SkillStack, History } from './ProfileCards';
import { colors as c, mobile } from '@/styles/design';

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

  const links = user.externalLinks ?? [];
  const stacks = user.stacks ?? [];
  const awards = user.awardHistory ?? [];

  return (
    <UserShell title="프로필" compact>
      <Content>
        <Grid>
          <Profile>
            <Identity user={user} />
            <Badges badges={user.badges ?? []} />
            <Stack gap={12} style={{ borderTop: `1px solid ${c.gray100}`, paddingTop: 20 }}>
              <Heading>외부 링크</Heading>
              {links.length === 0 ? (
                <Muted>등록된 외부 링크가 없어요.</Muted>
              ) : (
                links.map((link) => (
                  <a
                    key={link.url ?? link.label}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 13, color: c.gray700 }}
                  >
                    <Row gap={8}>
                      <Icon name="imgLink2Icon" size={16} />
                      {link.label ?? link.url}
                    </Row>
                  </a>
                ))
              )}
            </Stack>
            <Link
              href={`/reports/new?targetType=user&targetId=${userId}`}
              style={{ alignSelf: 'center' }}
            >
              <Button as="span" small tone="plain">
                신고
              </Button>
            </Link>
          </Profile>
          <Stack>
            <Heading>기술 스택</Heading>
            {stacks.length === 0 ? (
              <Muted>등록된 기술 스택이 없어요.</Muted>
            ) : (
              <SkillStack skills={stacks} />
            )}
            <Heading>출품 / 수상 이력</Heading>
            {awards.length === 0 ? (
              <Muted>등록된 수상 이력이 없어요.</Muted>
            ) : (
              <History awards={awards} />
            )}
          </Stack>
        </Grid>
      </Content>
    </UserShell>
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
  [mobile]: { display: 'flex', flexDirection: 'column', gap: 32 },
});

const Profile = styled.div({
  padding: 24,
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  [mobile]: { border: 0, padding: 0 },
});
