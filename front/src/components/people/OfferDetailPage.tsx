'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { UserShell, Content } from '@/components/common/UserShell';
import { useToast } from '@/components/common/Toast';
import { Button, Muted, Row, Stack } from '@/components/common/Primitives';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

const statusLabel: Record<string, string> = {
  invited: '대기 중',
  accepted: '수락함',
  rejected: '거절함',
};

const Card = styled.section({
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  padding: 28,
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 16,
  background: c.white,
});
const Circle = styled.span<{ size: number }>(({ size }) => ({
  flexShrink: 0,
  width: size,
  height: size,
  borderRadius: '50%',
  background: c.gray100,
}));
const Chip = styled.span({
  ...textStyle.label,
  padding: '4px 10px',
  borderRadius: 100,
  background: c.gray100,
  color: c.gray700,
});
const TeamBlock = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: 16,
  borderRadius: 12,
  background: c.gray50,
});
const SectionTitle = styled.h3({ ...textStyle.caption2, color: c.gray900 });
const Box = styled.div({
  padding: 14,
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 10,
  ...textStyle.caption,
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
});
const CtaBar = styled.div({
  position: 'sticky',
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  flexWrap: 'wrap',
  padding: '16px max(24px, calc((100% - 1200px) / 2))',
  borderTop: `0.5px solid ${c.gray100}`,
  background: c.white,
});
const Menu = styled.div({
  position: 'absolute',
  right: 0,
  top: 44,
  minWidth: 150,
  padding: 6,
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 10,
  background: c.white,
  boxShadow: '0 6px 8px rgb(0 0 0 / 12%)',
  '& a': { display: 'block', padding: '9px 12px', borderRadius: 6, ...textStyle.caption },
  '& a:hover': { background: c.gray50 },
});

export function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const auth = generated.useGetMyAuthInfo({ query: { retry: false } });
  const me = auth.data?.status === 200 ? auth.data.data : undefined;
  const offerQuery = generated.useGetTeamOffer(id, { query: { retry: false } });
  const offer = offerQuery.data?.status === 200 ? offerQuery.data.data : undefined;
  const respond = generated.useUpdateTeamMember();

  const decide = (status: 'accepted' | 'rejected') => {
    if (!offer?.teamId || !offer.id) return;
    respond.mutate(
      { id: offer.teamId, memberId: offer.id, data: { status } },
      {
        onSuccess: () => {
          toast.success(status === 'accepted' ? '제안을 수락했어요' : '제안을 거절했어요');
          void queryClient.invalidateQueries({ queryKey: generated.getGetTeamOfferQueryKey(id) });
        },
        onError: () => toast.error('응답에 실패했어요', '잠시 후 다시 시도해주세요'),
      },
    );
  };

  if (offerQuery.isPending) {
    return (
      <UserShell title="제안 상세" compact>
        <Content />
      </UserShell>
    );
  }
  if (!offer) {
    return (
      <UserShell title="제안 상세" compact>
        <Content>
          <Muted>제안을 찾을 수 없어요.</Muted>
        </Content>
      </UserShell>
    );
  }

  const canRespond = offer.status === 'invited' && offer.sender?.id !== me?.id;
  const teamTitle = offer.team?.title ?? '';
  const received = offer.receivedAt ? new Date(offer.receivedAt).toLocaleDateString('ko-KR') : '';

  return (
    <UserShell title="제안 상세" compact>
      <Content>
        <Stack gap={24}>
          <Row style={{ justifyContent: 'space-between', position: 'relative' }}>
            <Row gap={12}>
              <Button tone="plain" small aria-label="뒤로가기" onClick={() => router.back()}>
                ←
              </Button>
              <h1 style={{ ...textStyle.h2_2 }}>제안 상세</h1>
            </Row>
            <Button
              tone="plain"
              small
              aria-label="더보기"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              ⋯
            </Button>
            {menuOpen && (
              <Menu>
                {/* TODO: Figma 더보기 메뉴의 "차단"은 차단 기능이 없어 제외했다. */}
                <Link href={`/reports/new?targetType=user&targetId=${offer.sender?.id ?? ''}`}>
                  신고
                </Link>
              </Menu>
            )}
          </Row>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={12}>
                <Circle size={52} aria-hidden />
                <Stack gap={3}>
                  <strong style={{ ...textStyle.h2_2 }}>{offer.sender?.name ?? '이름 없음'}</strong>
                  <Muted style={{ fontSize: 12 }}>{received} 받음</Muted>
                </Stack>
              </Row>
              <Chip>{statusLabel[offer.status ?? ''] ?? offer.status}</Chip>
            </Row>
            <TeamBlock>
              <Circle size={48} aria-hidden />
              <Stack gap={4}>
                <strong style={{ ...textStyle.h2, color: c.gray900 }}>{teamTitle}</strong>
                <Muted style={{ fontSize: 12 }}>{offer.team?.challengeTitle}</Muted>
                <Muted style={{ fontSize: 11 }}>
                  팀원 {offer.team?.memberCount}/{offer.team?.capacity}명
                  {offer.team?.status === 'recruiting' ? ' · 모집 중' : ' · 모집 마감'}
                </Muted>
              </Stack>
            </TeamBlock>
            {offer.team?.introduction && (
              <Stack gap={8}>
                <SectionTitle>팀 소개</SectionTitle>
                <Box style={{ border: 0, padding: 0 }}>{offer.team.introduction}</Box>
              </Stack>
            )}
            <Stack gap={8}>
              <SectionTitle>보낸 메시지</SectionTitle>
              <Box>{offer.message || '남긴 메시지가 없어요.'}</Box>
            </Stack>
            <Stack gap={8}>
              <SectionTitle>보낸 사람</SectionTitle>
              <Link href={`/profile?id=${offer.sender?.id ?? ''}`}>
                <Box
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <Row gap={10}>
                    <Circle size={32} aria-hidden />
                    <Stack gap={2}>
                      <strong style={{ ...textStyle.caption2, color: c.gray900 }}>
                        {offer.sender?.name ?? '이름 없음'}
                      </strong>
                      <span style={{ ...textStyle.labelSmall, color: c.primary }}>
                        챌린지 {offer.sender?.challengeCount ?? 0}회 · 배지{' '}
                        {offer.sender?.badgeCount ?? 0}개 · 프로필 보기
                      </span>
                    </Stack>
                  </Row>
                  <span aria-hidden>›</span>
                </Box>
              </Link>
            </Stack>
          </Card>
        </Stack>
      </Content>
      {canRespond && (
        <CtaBar>
          <Stack gap={3}>
            <strong style={{ ...textStyle.caption2, color: c.gray900 }}>
              수락하면 &lsquo;{teamTitle}&rsquo; 팀원으로 합류돼요
            </strong>
            <Muted style={{ fontSize: 11 }}>거절해도 다른 팀의 제안은 계속 받을 수 있어요</Muted>
          </Stack>
          <Row gap={8}>
            <Button tone="plain" disabled={respond.isPending} onClick={() => decide('rejected')}>
              거절하기
            </Button>
            <Button disabled={respond.isPending} onClick={() => decide('accepted')}>
              수락하기
            </Button>
          </Row>
        </CtaBar>
      )}
    </UserShell>
  );
}
