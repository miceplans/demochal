'use client';
import Link from 'next/link';
import styled from '@emotion/styled';
import { UserShell, Content } from '@/components/common/UserShell';
import { Button, Heading, Stack, Icon, Row } from '@/components/common/Primitives';
import { Badges, Identity, SkillStack, History } from './ProfileCards';
import { colors as c, mobile } from '@/styles/design';
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
export function ProfilePage() {
  return (
    <UserShell title="프로필" compact>
      <Content>
        <Grid>
          <Profile>
            <Identity />
            <Badges />
            <Stack gap={12} style={{ borderTop: `1px solid ${c.gray100}`, paddingTop: 20 }}>
              <Heading>외부 링크</Heading>
              {[
                ['github.com/juhyun-kim', 'imgLink1Icon'],
                ['portfolio.juhyun.dev', 'imgLink2Icon'],
                ['notion.so/juhyun-resume', 'imgLink3Icon'],
              ].map(([text, icon]) => (
                <a
                  key={text}
                  href={`https://${text}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 13, color: c.gray700 }}
                >
                  <Row gap={8}>
                    <Icon frame="195-1309" name={icon} size={16} />
                    {text}
                  </Row>
                </a>
              ))}
            </Stack>
            <Link href="/teams/new">
              <Button as="span" fullWidth>
                팀에 초대
              </Button>
            </Link>
          </Profile>
          <Stack>
            <Heading>기술 스택</Heading>
            <SkillStack />
            <Heading>출품 / 수상 이력</Heading>
            <History />
          </Stack>
        </Grid>
      </Content>
    </UserShell>
  );
}
