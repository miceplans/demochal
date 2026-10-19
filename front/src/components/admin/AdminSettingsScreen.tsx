'use client';

import { useState } from 'react';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { AdminPageTitle, ApproveButton } from './parts';
import { Input, Toggle } from '@/components/common/Primitives';
import { useToast } from '@/components/common/Toast';

const MAINTENANCE_START_KEY = 'maintenanceStartAt';
const MAINTENANCE_END_KEY = 'maintenanceEndAt';

/** ISO 문자열을 datetime-local 입력값(로컬 YYYY-MM-DDTHH:mm)으로 바꾼다. null이면 빈 값. */
function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** datetime-local 값을 ISO로 바꾼다. 빈 값은 null(점검 기간 초기화)이다. */
function toIsoOrNull(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

type MaintenanceStatus = { label: string; tone: 'active' | 'scheduled' | 'ended' | 'none' };

/** 화면에 표시할 점검 상태 — 미저장 변경분이 있으면 그 값 기준으로 계산한다. */
function resolveStatus(
  startAt: string | null | undefined,
  endAt: string | null | undefined,
): MaintenanceStatus {
  if (!startAt || !endAt) return { label: '미설정', tone: 'none' };
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return { label: '미설정', tone: 'none' };
  const now = Date.now();
  if (start <= now && now < end) return { label: '점검 진행 중', tone: 'active' };
  if (now < start) return { label: '점검 예정', tone: 'scheduled' };
  return { label: '점검 종료', tone: 'ended' };
}

export function AdminSettingsScreen() {
  // 서버 값 위에 아직 저장하지 않은 로컬 토글 변경분만 덮어쓴다 (서버 데이터를 state로 복제하지 않음).
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  // 점검 기간 변경분(ISO 문자열 또는 null)만 담는다 — 입력 전에는 키 자체가 없다.
  const [pendingWindow, setPendingWindow] = useState<{
    startAt?: string | null;
    endAt?: string | null;
  }>({});
  const toast = useToast();
  const queryClient = useQueryClient();

  const settingsQuery = generated.useGetAdminSettings();
  const settings = settingsQuery.data?.data;
  const values = { ...(settings?.values ?? {}), ...pendingChanges };
  const maintenance = settings?.maintenance;
  const effectiveStart = pendingWindow.startAt !== undefined ? pendingWindow.startAt : (maintenance?.startAt ?? null);
  const effectiveEnd = pendingWindow.endAt !== undefined ? pendingWindow.endAt : (maintenance?.endAt ?? null);
  const status = resolveStatus(effectiveStart, effectiveEnd);

  const updateSettingsMutation = generated.useUpdateAdminSettings({
    mutation: {
      onSuccess: (response, variables) => {
        toast.success('설정을 저장했어요');
        // 응답이 곧 최신 getSettings() 결과이므로 별도 refetch 없이 캐시에 바로 반영한다
        // (refetch 대기 중 stale 값이 깜빡이거나, refetch 실패 시 stale 상태로 남는 것을 방지).
        queryClient.setQueryData(generated.getGetAdminSettingsQueryKey(), response);
        // 방금 본낸 값(variables.data)과 여전히 같은 키만 pending에서 제거한다.
        // 저장 요청이 날아간 뒤 응답이 오기 전에 admin이 다른 토글/시각을 또 바꿨다면
        // 그 새 미저장 변경분은 지우지 않고 남겨둔다.
        const submitted = variables.data as Record<string, unknown> | undefined;
        setPendingChanges((current) => {
          const next = { ...current };
          for (const key of Object.keys(submitted ?? {})) {
            if (next[key] === submitted?.[key]) delete next[key];
          }
          return next;
        });
        setPendingWindow((current) => {
          const next = { ...current };
          if (next.startAt !== undefined && next.startAt === submitted?.[MAINTENANCE_START_KEY]) {
            delete next.startAt;
          }
          if (next.endAt !== undefined && next.endAt === submitted?.[MAINTENANCE_END_KEY]) {
            delete next.endAt;
          }
          return next;
        });
      },
      onError: () => toast.error('설정 저장에 실패했어요', '잠시 후 다시 시도해주세요'),
    },
  });

  const profile = settings?.profile;
  const profileRows: [string, string][] = [
    ['이름', profile?.name ?? ''],
    ['역할', profile?.role ?? ''],
    ['이메일', profile?.email ?? ''],
    ['2단계 인증', profile?.twoFactorEnabled ? '사용중' : '미사용'],
  ];

  const hasPending =
    Object.keys(pendingChanges).length > 0 || Object.keys(pendingWindow).length > 0;

  const submit = () => {
    const start = effectiveStart;
    const end = effectiveEnd;
    if (start && end && new Date(start).getTime() >= new Date(end).getTime()) {
      toast.error('점검 시작 시각은 종료 시각보다 이전이어야 해요', '기간을 다시 확인해주세요');
      return;
    }
    const payload: Record<string, unknown> = { ...pendingChanges };
    if (pendingWindow.startAt !== undefined) payload[MAINTENANCE_START_KEY] = pendingWindow.startAt;
    if (pendingWindow.endAt !== undefined) payload[MAINTENANCE_END_KEY] = pendingWindow.endAt;
    updateSettingsMutation.mutate({ data: payload });
  };

  return (
    <>
      <AdminPageTitle>설정</AdminPageTitle>
      <Card aria-label="관리자 계정 정보">
        <CardTitle>계정 정보</CardTitle>
        {profileRows.map(([label, value]) => (
          <ProfileRow key={label}>
            <ProfileLabel>{label}</ProfileLabel>
            <strong>{value}</strong>
          </ProfileRow>
        ))}
      </Card>
      <Card aria-label="점검 기간">
        <CardTitle>점검 기간</CardTitle>
        <SettingRow>
          <SettingText>
            <SettingLabel>서비스 점검</SettingLabel>
            <SettingDesc>
              설정한 기간 동안 방문자에게 점검 안내 화면이 표시되고, 기간이 지나면 자동으로
              해제됩니다.
            </SettingDesc>
          </SettingText>
          <StatusBadge $tone={status.tone}>{status.label}</StatusBadge>
        </SettingRow>
        <SettingRow>
          <SettingText>
            <SettingLabel>시작 시각</SettingLabel>
          </SettingText>
          <PeriodInputWrap>
            <Input
              aria-label="점검 시작 시각"
              type="datetime-local"
              value={toLocalInputValue(effectiveStart)}
              onChange={(event) =>
                setPendingWindow((current) => ({
                  ...current,
                  startAt: toIsoOrNull(event.target.value),
                }))
              }
            />
          </PeriodInputWrap>
        </SettingRow>
        <SettingRow>
          <SettingText>
            <SettingLabel>종료 시각</SettingLabel>
          </SettingText>
          <PeriodInputWrap>
            <Input
              aria-label="점검 종료 시각"
              type="datetime-local"
              value={toLocalInputValue(effectiveEnd)}
              onChange={(event) =>
                setPendingWindow((current) => ({
                  ...current,
                  endAt: toIsoOrNull(event.target.value),
                }))
              }
            />
          </PeriodInputWrap>
        </SettingRow>
      </Card>
      {(settings?.groups ?? []).map((group) => (
        <Card key={group.title} aria-label={group.title}>
          <CardTitle>{group.title}</CardTitle>
          {(group.rows ?? []).map((row) => {
            const rowKey = row.key ?? '';
            return (
              <SettingRow key={rowKey}>
                <SettingText>
                  <SettingLabel>{row.label}</SettingLabel>
                  <SettingDesc>{row.description}</SettingDesc>
                </SettingText>
                <Toggle
                  label={row.label ?? ''}
                  checked={values[rowKey] ?? false}
                  onChange={() =>
                    setPendingChanges((v) => ({ ...v, [rowKey]: !(values[rowKey] ?? false) }))
                  }
                />
              </SettingRow>
            );
          })}
        </Card>
      ))}
      <div>
        <ApproveButton disabled={updateSettingsMutation.isPending || !hasPending} onClick={submit}>
          {updateSettingsMutation.isPending ? '저장 중…' : '저장하기'}
        </ApproveButton>
      </div>
    </>
  );
}

const Card = styled.section({
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 16,
  background: c.white,
  overflow: 'hidden',
});
const CardTitle = styled.h2({
  padding: '16px 20px',
  background: c.gray100,
  ...textStyle.h3_2,
  color: c.gray900,
});
const ProfileRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 24,
  padding: '16px 20px',
  borderTop: `0.5px solid ${c.gray200}`,
  ...textStyle.body,
  color: c.gray900,
});
const ProfileLabel = styled.span({ color: c.gray500, flexShrink: 0 });
const SettingRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 24,
  padding: '16px 20px',
  borderTop: `0.5px solid ${c.gray200}`,
});
const SettingText = styled.div({ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 });
const SettingLabel = styled.span({ ...textStyle.body, color: c.gray900 });
const SettingDesc = styled.span({ ...textStyle.metaText, color: c.gray500 });
const PeriodInputWrap = styled.div({ width: 220, flexShrink: 0 });
const StatusBadge = styled.span<{ $tone: MaintenanceStatus['tone'] }>(({ $tone }) => ({
  flexShrink: 0,
  padding: '4px 10px',
  borderRadius: 999,
  ...textStyle.overline,
  fontWeight: 600,
  color:
    $tone === 'active'
      ? c.red
      : $tone === 'scheduled'
        ? c.primary
        : c.gray500,
  background:
    $tone === 'active' ? c.lightRed : $tone === 'scheduled' ? c.paleBlue : c.gray100,
}));
