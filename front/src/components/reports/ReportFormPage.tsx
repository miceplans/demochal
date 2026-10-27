'use client';

import { Suspense, useState } from 'react';
import { LoadingState } from '@/components/common/LoadingState';
import { useRouter, useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { UserShell, Content } from '@/components/common/UserShell';
import { Button, Muted, Title } from '@/components/common/Primitives';
import { Dropdown } from '@/components/ui/Dropdown';
import { useToast } from '@/components/common/Toast';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { formatDateDot as formatDate } from '@/lib/date';
import { challengeEligibility } from '@/lib/challenge';

const REPORT_REASONS = ['비방', '스팸/도배', '사기 또는 허위 정보', '저작권 침해', '기타'];

type ReportType = 'challenge' | 'team' | 'user';

function isReportType(value: string | null): value is ReportType {
  return value === 'challenge' || value === 'team' || value === 'user';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PreviewMeta = { label: string; value: string };
type Preview = { title: string; org?: string; meta: PreviewMeta[]; image?: string | null };

function ReportFormContent() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  // 기존 링크(?type=&id=)와 새 링크(?targetType=&targetId=) 둘 다 받는다.
  const typeParam = searchParams.get('targetType') ?? searchParams.get('type');
  const type = isReportType(typeParam) ? typeParam : null;
  const rawTargetId = searchParams.get('targetId') ?? searchParams.get('id');
  const targetId = rawTargetId && UUID_RE.test(rawTargetId) ? rawTargetId : null;

  const enabled = type !== null && targetId !== null;
  const challengeQuery = generated.useGetChallenge(targetId ?? '', {
    query: { enabled: enabled && type === 'challenge', retry: false },
  });
  const teamQuery = generated.useGetTeam(targetId ?? '', {
    query: { enabled: enabled && type === 'team', retry: false },
  });
  const userQuery = generated.useGetUser(targetId ?? '', {
    query: { enabled: enabled && type === 'user', retry: false },
  });

  const challenge =
    type === 'challenge' && challengeQuery.data?.status === 200
      ? challengeQuery.data.data
      : undefined;
  const team = type === 'team' && teamQuery.data?.status === 200 ? teamQuery.data.data : undefined;
  const user = type === 'user' && userQuery.data?.status === 200 ? userQuery.data.data : undefined;
  const targetPending = enabled
    ? type === 'challenge'
      ? challengeQuery.isPending
      : type === 'team'
        ? teamQuery.isPending
        : userQuery.isPending
    : false;
  const target = challenge ?? team ?? user;

  let preview: Preview | undefined;
  if (challenge) {
    preview = {
      title: challenge.title ?? '챌린지',
      org: challenge.organizer,
      image: challenge.thumbnailUrl ?? challenge.posterUrl ?? null,
      meta: [
        { label: '자격 / 대상', value: challengeEligibility(challenge, '-') },
        {
          label: '접수기간',
          value: `${formatDate(challenge.startDate)} ~ ${formatDate(challenge.endDate)}`,
        },
      ],
    };
  } else if (team) {
    preview = {
      title: team.title ?? '팀 모집글',
      org: team.challengeTitle,
      image: team.challengeThumbnailUrl ?? team.challengePosterUrl ?? null,
      meta: [
        {
          label: '모집 역할',
          value:
            team.openRoles
              ?.map((slot) => (slot.count ? `${slot.role} ${slot.count}명` : (slot.role ?? '')))
              .filter(Boolean)
              .join(', ') || '모집 완료',
        },
        { label: '활동 지역', value: team.region ?? '-' },
      ],
    };
  } else if (user) {
    preview = {
      title: user.name ?? '사용자',
      org: user.position,
      image: user.profileImageUrl ?? null,
      meta: [
        { label: '활동 지역', value: user.region ?? '-' },
        { label: '가입일', value: formatDate(user.createdAt) },
      ],
    };
  }
  // 대상 id/종류가 유효하지 않거나 조회에 실패하면 폼을 비활성화한다.
  const targetMissing = !enabled || (!targetPending && !preview);

  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  // 대상 이미지 로드에 실패하면 placeholder로 되돌린다.
  const [imageFailed, setImageFailed] = useState(false);

  const createReport = generated.useCreateReport({
    mutation: {
      onSuccess: () => {
        toast.success('신고가 접수되었어요');
        router.back();
      },
      onError: () => toast.error('신고 접수에 실패했어요', '잠시 후 다시 시도해주세요'),
    },
  });

  const submit = () => {
    if (!reason) {
      toast.error('신고 사유를 선택해주세요');
      return;
    }
    if (!type || !targetId || !preview) return;
    createReport.mutate({
      data: {
        targetType: type,
        targetId,
        summary: reason,
        detail: detail || undefined,
        org: preview.org,
        reportedUserId: type === 'user' ? targetId : undefined,
      },
    });
  };

  return (
    <UserShell compact navigation={false} footer={false}>
      <Form size="narrow">
        <Title>신고하기</Title>
        {targetPending ? (
          <LoadingState label="신고 대상을 불러오는 중이에요…" />
        ) : !preview ? (
          <Muted>신고 대상을 찾을 수 없어요. 대상 링크를 다시 확인해주세요.</Muted>
        ) : (
          <PreviewHeader>
            <PreviewArtwork>
              {preview.image && !imageFailed ? (
                <img src={preview.image} alt="" onError={() => setImageFailed(true)} />
              ) : null}
            </PreviewArtwork>
            <PreviewBody>
              <div>
                <p className="preview-title">{preview.title}</p>
                <Muted>{preview.org}</Muted>
              </div>
              <dl>
                {preview.meta.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </PreviewBody>
          </PreviewHeader>
        )}
        <Field>
          <label>신고 사유를 선택해주세요</label>
          <Dropdown
            aria-label="신고 사유"
            placeholder="사유를 선택하세요"
            value={reason}
            onChange={setReason}
            options={REPORT_REASONS.map((x) => ({ value: x, label: x }))}
            disabled={targetMissing}
          />
        </Field>
        <Field>
          <label>자세한 내용을 기술해주세요</label>
          <Textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            disabled={targetMissing}
          />
        </Field>
        <Button
          fullWidth
          style={{ height: 48 }}
          disabled={targetMissing || createReport.isPending}
          onClick={submit}
        >
          신고하기
        </Button>
      </Form>
    </UserShell>
  );
}

export function ReportFormPage() {
  return (
    <Suspense fallback={null}>
      <ReportFormContent />
    </Suspense>
  );
}

const Form = styled(Content)({
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
  [mobile]: { padding: '24px 16px 110px' },
});

const PreviewHeader = styled.div({
  display: 'flex',
  gap: 24,
  alignItems: 'flex-end',
  [mobile]: { flexDirection: 'column', alignItems: 'stretch' },
});

const PreviewArtwork = styled.div({
  width: 223,
  height: 156,
  flexShrink: 0,
  background: c.gray100,
  borderRadius: 12,
  overflow: 'hidden',
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
});

const PreviewBody = styled.div({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 16,
  minWidth: 0,
  '.preview-title': { ...textStyle.h2, marginBottom: 10 },
  dl: { display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 },
  'dl > div': { display: 'flex', gap: 9, alignItems: 'baseline' },
  dt: { ...textStyle.mBadgeText, color: c.gray900, whiteSpace: 'nowrap' },
  dd: { color: c.gray700 },
});

const Field = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  '& > label': { ...textStyle.h2, color: c.gray900 },
});

const Textarea = styled.textarea({
  height: 106,
  resize: 'vertical',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  padding: '12px 14px',
  background: c.white,
  color: c.gray900,
  ...textStyle.body,
  '&::placeholder': { color: c.gray500 },
  '&:focus': { outline: 'none', borderColor: c.primary },
});
