'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { UserShell } from '@/components/common/UserShell';
import { Button, EmptyArtwork, Muted, Title } from '@/components/common/Primitives';
import { Dropdown } from '@/components/ui/Dropdown';
import { useToast } from '@/components/common/Toast';
import { contestDetail, profileUser, teams } from '@/data/user-design';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';

const REPORT_REASONS = ['비방', '스팸/도배', '사기 또는 허위 정보', '저작권 침해', '기타'];

type ReportType = 'challenge' | 'team' | 'user';

function isReportType(value: string | null): value is ReportType {
  return value === 'challenge' || value === 'team' || value === 'user';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getReportPreview(type: ReportType, targetId: string | null) {
  if (type === 'team') {
    const team = teams.find((t) => t.id === targetId) ?? teams[0]!;
    return {
      title: team.name,
      org: team.challenge,
      meta: [
        { label: '모집 인원', value: team.members },
        { label: '모집 역할', value: team.recruitingRoles.join(', ') || '모집 완료' },
      ],
    };
  }
  if (type === 'user') {
    return {
      title: profileUser.name,
      org: profileUser.role,
      meta: [
        { label: '활동 지역', value: profileUser.region },
        { label: '소개', value: profileUser.intro },
      ],
    };
  }
  return {
    title: contestDetail.title,
    org: contestDetail.org,
    meta: [
      { label: '자격 / 대상', value: contestDetail.eligibility },
      { label: '접수기간', value: contestDetail.period },
    ],
  };
}

function ReportFormContent() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');
  const type = isReportType(typeParam) ? typeParam : 'challenge';
  const targetId = searchParams.get('id');
  const preview = getReportPreview(type, targetId);

  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');

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
    createReport.mutate({
      data: {
        targetType: type,
        targetId: targetId && UUID_RE.test(targetId) ? targetId : undefined,
        summary: reason,
        detail: detail || undefined,
        org: preview.org,
      },
    });
  };

  return (
    <UserShell compact navigation={false} footer={false}>
      <Form>
        <Title>신고하기</Title>
        <PreviewHeader>
          <EmptyArtwork style={{ width: 223, height: 156, flexShrink: 0 }} />
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
        <Field>
          <label>신고 사유를 선택해주세요</label>
          <Dropdown
            aria-label="신고 사유"
            placeholder="사유를 선택하세요"
            value={reason}
            onChange={setReason}
            options={REPORT_REASONS.map((x) => ({ value: x, label: x }))}
          />
        </Field>
        <Field>
          <label>자세한 내용을 기술해주세요</label>
          <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} />
        </Field>
        <Button fullWidth style={{ height: 48 }} disabled={createReport.isPending} onClick={submit}>
          게시하기
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

const Form = styled.div({
  width: 640,
  maxWidth: 'calc(100% - 32px)',
  margin: '0 auto',
  padding: '40px 0',
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
  [mobile]: { padding: '24px 0 110px' },
});

const PreviewHeader = styled.div({
  display: 'flex',
  gap: 24,
  alignItems: 'flex-end',
  [mobile]: { flexDirection: 'column', alignItems: 'stretch' },
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
  border: `1px solid ${c.gray100}`,
  borderRadius: 8,
  padding: '12px 14px',
  color: c.gray900,
  ...textStyle.body,
  '&:focus': { outline: 'none', borderColor: c.primary },
});
