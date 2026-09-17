'use client';

import { useState } from 'react';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { AdminPageTitle, ApproveButton } from './parts';
import { Toggle } from '@/components/common/Primitives';
import { useToast } from '@/components/common/Toast';

export function AdminSettingsScreen() {
  // 서버 값 위에 아직 저장하지 않은 로컬 토글 변경분만 덮어쓴다 (서버 데이터를 state로 복제하지 않음).
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
  const toast = useToast();

  const settingsQuery = generated.useGetAdminSettings();
  const settings = settingsQuery.data?.data;
  const values = { ...(settings?.values ?? {}), ...pendingChanges };

  const updateSettingsMutation = generated.useUpdateAdminSettings({
    mutation: {
      onSuccess: () => {
        toast.success('설정을 저장했어요');
        setPendingChanges({});
        settingsQuery.refetch();
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
        <ApproveButton
          disabled={updateSettingsMutation.isPending}
          onClick={() => updateSettingsMutation.mutate({ data: values })}
        >
          {updateSettingsMutation.isPending ? '저장 중…' : '저장하기'}
        </ApproveButton>
      </div>
    </>
  );
}

const Card = styled.section({
  border: '1px solid #DFE2E7',
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
  borderTop: '1px solid #DFE2E7',
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
  borderTop: '1px solid #DFE2E7',
});
const SettingText = styled.div({ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 });
const SettingLabel = styled.span({ ...textStyle.body, color: c.gray900 });
const SettingDesc = styled.span({ ...textStyle.metaText, color: c.gray500 });
