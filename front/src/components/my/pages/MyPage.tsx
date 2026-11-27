'use client';
import { useState, type ChangeEvent } from 'react';
import { LoadingState } from '@/components/common/LoadingState';
import Link from 'next/link';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { MyShell, myMenu } from '@/components/common/UserShell';
import {
  DesktopOnly,
  MobileOnly,
  Row,
  Stack,
  Wrap,
  Heading,
  Muted,
  Tag,
} from '@/components/common/Primitives';
import { Badges, HistoryCard } from '@/components/profile/ProfileCards';
import { useToast } from '@/components/common/Toast';
import { colors as c, mobile } from '@/styles/design';
import { ApiError, generated } from '@semochal/api-client';
import { compressToWebP, PROFILE_IMAGE_PRESET } from '@/lib/image-compression';
import { useFileUpload } from '@/lib/upload';
import {
  challengeResultTag,
  formatParticipatingDay,
  PROFILE_IMAGE_CONTENT_TYPES,
  PROFILE_IMAGE_MAX_BYTES,
  teamResultTag,
  type ParticipatingItem,
} from '../Mypage';
import { useAuth } from '@/features/auth/AuthProvider';
import { ProfileEditor, useCertificateLabels } from '../ProfileEditor';

// 모바일 마이페이지 '참가 이력' — 챌린지·팀 지원 내역을 실제 상세 링크와 함께 보여준다(#278).
function ParticipationHistory() {
  const challengeQuery = generated.useListMyApplications();
  const teamQuery = generated.useListMyTeamApplications();
  const challengeApps = challengeQuery.data?.status === 200 ? challengeQuery.data.data : [];
  const teamApps = teamQuery.data?.status === 200 ? teamQuery.data.data : [];
  const items = [
    ...challengeApps.map((row) => ({
      id: row.id ?? '',
      title: row.challengeTitle ?? '챌린지',
      sub: row.businessName ?? '-',
      createdAt: row.createdAt ?? '',
      href: row.challengeId ? `/contests/${row.challengeId}` : '/my/applications',
      result: challengeResultTag(row.status),
    })),
    ...teamApps.map((row) => ({
      id: row.id ?? '',
      title: row.teamTitle ?? '팀',
      sub: row.challengeTitle ?? '챌린지',
      createdAt: row.createdAt ?? '',
      href: '/my/applications',
      result: teamResultTag(row.status),
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const isPending = challengeQuery.isPending || teamQuery.isPending;
  const isError = challengeQuery.isError || teamQuery.isError;
  return (
    <Stack gap={16}>
      {items.map((item) => (
        <HistoryCard key={item.id} href={item.href}>
          <div className="thumb" />
          <div>
            <h3>{item.title}</h3>
            <Row gap={8}>
              <Tag tone={item.result.tone}>{item.result.label}</Tag>
              <Muted>{item.sub}</Muted>
            </Row>
          </div>
        </HistoryCard>
      ))}
      {isPending && <LoadingState label="참가 이력을 불러오는 중이에요." />}
      {isError && <Muted>참가 이력을 불러오지 못했어요. 새로고침해주세요.</Muted>}
      {!isPending && !isError && items.length === 0 && <Muted>아직 참가 이력이 없어요.</Muted>}
    </Stack>
  );
}

export function MyPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user: meInfo } = useAuth();
  // 이름이 없으면 이메일 앞부분을, 그마저 없으면 표시명을 쓴다.
  const displayName =
    meInfo?.name?.trim() || (meInfo?.email ? meInfo.email.split('@')[0] : '') || '사용자';
  const profileMeta = [meInfo?.position, meInfo?.region].filter(Boolean).join(' · ');
  const certificates = useCertificateLabels();
  // 참여중 = 수락된 팀 멤버십과 챌린지 지원(예선 통과). 심사중 지원은 지원현황 페이지에서 본다.
  const participatingTeamsQuery = generated.useListMyTeamApplications();
  const participatingChallengesQuery = generated.useListMyApplications();
  const participatingItems: ParticipatingItem[] = [
    ...(participatingTeamsQuery.data?.status === 200 ? participatingTeamsQuery.data.data : [])
      .filter((x) => x.status === 'accepted')
      .map((x) => ({
        key: `team-${x.id ?? ''}`,
        href: x.teamId ? `/teams/${x.teamId}` : '/teams',
        title: x.challengeTitle ?? x.teamTitle ?? '챌린지',
        sub: x.challengeTitle ? x.teamTitle : undefined,
        role: x.role ?? undefined,
        meta: ['팀 참여 확정', formatParticipatingDay(x.createdAt)].filter(Boolean).join(' · '),
      })),
    ...(participatingChallengesQuery.data?.status === 200
      ? participatingChallengesQuery.data.data
      : []
    )
      .filter((x) => x.status === 'accepted')
      .map((x) => ({
        key: `challenge-${x.id ?? ''}`,
        href: x.challengeId ? `/contests/${x.challengeId}` : '/contests',
        title: x.challengeTitle ?? '챌린지',
        sub: x.businessName ?? undefined,
        role: x.role ?? undefined,
        meta: ['예선 통과', formatParticipatingDay(x.createdAt)].filter(Boolean).join(' · '),
      })),
  ];
  const updateProfile = generated.useUpdateMyProfile({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: generated.getGetMyAuthInfoQueryKey() });
      },
    },
  });
  const uploadFile = useFileUpload();
  const [avatarUploading, setAvatarUploading] = useState(false);
  // 프로필 이미지는 다른 사용자에게 보이므로 public 버킷에 올린다(presign → S3 PUT → finalize → 프로필 저장).
  const pickAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const picked = input.files?.[0];
    // 같은 파일을 다시 골라도 change가 발생하도록 비운다.
    input.value = '';
    if (!picked || avatarUploading) return;
    if (!PROFILE_IMAGE_CONTENT_TYPES.includes(picked.type)) {
      toast.error('지원하지 않는 파일이에요', 'JPG, PNG, WEBP 이미지만 올릴 수 있어요');
      return;
    }
    if (picked.size === 0 || picked.size > PROFILE_IMAGE_MAX_BYTES) {
      toast.error('파일 크기를 확인해주세요', '10MB 이하 이미지만 올릴 수 있어요');
      return;
    }
    setAvatarUploading(true);
    let previewUrl: string | undefined;
    try {
      const compressed = await compressToWebP(picked, PROFILE_IMAGE_PRESET);
      previewUrl = compressed.previewUrl;
      const { fileId } = await uploadFile(compressed.file, {
        bucket: 'public',
        contentType: 'image/webp',
      });
      await updateProfile.mutateAsync({ data: { profileImageFileId: fileId } });
      toast.success('프로필 이미지를 바꿨어요');
    } catch (error) {
      // API 단계 실패는 전역 MutationCache 토스트가 띄운다. 압축/S3 업로드 실패만 여기서 알린다.
      if (!(error instanceof ApiError)) {
        toast.error('이미지 업로드에 실패했어요', '잠시 후 다시 시도해주세요');
      }
    } finally {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setAvatarUploading(false);
    }
  };
  return (
    <MyShell title="MY" hideMobileTitle>
      <Stack gap={28}>
        <Row gap={24}>
          <AvatarPicker busy={avatarUploading} aria-label="프로필 이미지 변경">
            <MyAvatar large>
              {meInfo?.profileImageUrl ? <AvatarImage src={meInfo.profileImageUrl} alt="" /> : null}
            </MyAvatar>
            <HiddenInput
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={pickAvatar}
              disabled={avatarUploading}
            />
          </AvatarPicker>
          <Link href="/profile">
            <Stack gap={8}>
              <ProfileName>{displayName}</ProfileName>
              {profileMeta && <Muted>{profileMeta}</Muted>}
            </Stack>
          </Link>
        </Row>
        <DesktopOnly>
          <ProfileEditor />
        </DesktopOnly>
        <MobileOnly>
          <Stack gap={28}>
            {meInfo?.bio && <Muted>{meInfo.bio}</Muted>}
            <Badges extra={certificates} />
            <MobileMenu>
              {[['/my/profile-edit', '내 프로필 수정'], ...myMenu].map(([href, label]) => (
                <Link key={href} href={href}>
                  {label}
                  <MenuArrow>›</MenuArrow>
                </Link>
              ))}
            </MobileMenu>
          </Stack>
        </MobileOnly>
        <DesktopOnly>
          <HeadingSpaced $mb={24}>참여중</HeadingSpaced>
          {participatingTeamsQuery.isPending || participatingChallengesQuery.isPending ? (
            <LoadingState label="불러오는 중이에요." />
          ) : participatingTeamsQuery.isError || participatingChallengesQuery.isError ? (
            <Muted>참여 내역을 불러오지 못했어요. 새로고침해주세요.</Muted>
          ) : participatingItems.length === 0 ? (
            <Muted>아직 참여 중인 팀이나 챌린지가 없어요.</Muted>
          ) : (
            <Participating>
              {participatingItems.map((item) => (
                <Link key={item.key} href={item.href}>
                  <div>
                    <ParticipationTitle>{item.title}</ParticipationTitle>
                    {item.sub && <Muted>{item.sub}</Muted>}
                  </div>
                  {item.role && (
                    <ParticipationTags>
                      <Tag tone="blue">{item.role}</Tag>
                    </ParticipationTags>
                  )}
                  <ParticipationMeta>{item.meta}</ParticipationMeta>
                </Link>
              ))}
            </Participating>
          )}
        </DesktopOnly>
        <MobileOnly>
          <HeadingSpaced $mb={12}>참가 이력</HeadingSpaced>
          <ParticipationHistory />
        </MobileOnly>
      </Stack>
    </MyShell>
  );
}

// Styles are kept together at the bottom so page behavior and layout definitions remain separate.
const MobileMenu = styled.nav({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  '& a': {
    padding: '16px 8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 600,
    borderRadius: 8,
    transition: 'background 0.15s ease',
  },
  '& a:active': { background: c.gray50 },
  '& a:hover span': { transform: 'translateX(3px)' },
  '& a span': { display: 'inline-block', transition: 'transform 0.15s ease' },
  borderBottom: `0.5px solid ${c.gray100}`,
  paddingBottom: 24,
});
const Participating = styled.div({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 20,
  '& a': {
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
    border: `0.5px solid ${c.gray100}`,
    borderRadius: 12,
    padding: 16,
    transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease',
    '&:hover': {
      transform: 'translateY(-3px)',
      borderColor: c.gray200,
      boxShadow: '0 8px 20px rgb(0 0 0 / 8%)',
    },
  },
  [mobile]: { gridTemplateColumns: '1fr' },
});
const HiddenInput = styled.input({
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
});
const MyAvatar = styled.div<{ large?: boolean }>(({ large }) => ({
  width: large ? 110 : 64,
  height: large ? 110 : 64,
  borderRadius: '50%',
  background: c.gray100,
  flexShrink: 0,
  overflow: 'hidden',
  [mobile]: { width: 72, height: 72, background: c.paleBlue },
}));
const AvatarImage = styled.img({ width: '100%', height: '100%', objectFit: 'cover' });
const AvatarPicker = styled.label<{ busy?: boolean }>(({ busy }) => ({
  position: 'relative',
  display: 'block',
  flexShrink: 0,
  borderRadius: '50%',
  cursor: busy ? 'progress' : 'pointer',
  opacity: busy ? 0.6 : 1,
  '&:focus-within': { outline: '2px solid currentColor', outlineOffset: 2 },
}));
const HeadingSpaced = styled(Heading)<{ $mb: number }>(({ $mb }) => ({ marginBottom: $mb }));
const ProfileName = styled.h2({ fontSize: 20 });
const MenuArrow = styled.span({ fontSize: 14 });
const ParticipationTitle = styled(Heading)({ fontSize: 15 });
const ParticipationTags = styled(Wrap)({ gap: 6 });
const ParticipationMeta = styled(Muted)({ fontSize: 12 });
