'use client';

import { useState } from 'react';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { AdminPageTitle, ApproveButton } from './parts';
import { Toggle } from '@/components/common/Primitives';
import { useToast } from '@/components/common/Toast';

type AdminSettings = Awaited<ReturnType<typeof generated.getAdminSettings>>['data'];

function SettingsForm({ settings }: { settings: AdminSettings }) {
  const [values, setValues] = useState(settings.values ?? {});
  const toast = useToast();

  const updateMutation = generated.useUpdateAdminSettings({
    mutation: {
      onSuccess: () => toast.success('설정을 저장했어요.'),
      onError: () => toast.error('저장에 실패했어요', '잠시 후 다시 시도해주세요'),
    },
  });

  return (
    <>
      <Card aria-label="관리자 계정 정보">
        <CardTitle>계정 정보</CardTitle>
        {[
          ['이름', settings.profile?.name ?? ''],
          ['역할', settings.profile?.role ?? ''],
          ['이메일', settings.profile?.email ?? ''],
          ['2단계 인증', settings.profile?.twoFactorEnabled ? '사용중' : '미사용'],
        ].map(([label, value]) => (
          <ProfileRow key={label}>
            <ProfileLabel>{label}</ProfileLabel>
            <strong>{value}</strong>
          </ProfileRow>
        ))}
      </Card>
      {(settings.groups ?? []).map((group) => (
        <Card key={group.title} aria-label={group.title}>
          <CardTitle>{group.title}</CardTitle>
          {(group.rows ?? []).map((row) => (
            <SettingRow key={row.key}>
              <SettingText>
                <SettingLabel>{row.label}</SettingLabel>
                <SettingDesc>{row.description}</SettingDesc>
              </SettingText>
              <Toggle
                label={row.label ?? ''}
                checked={Boolean(row.key && values[row.key])}
                onChange={() =>
                  row.key &&
                  setValues((v) => ({ ...v, [row.key as string]: !v[row.key as string] }))
                }
              />
            </SettingRow>
          ))}
        </Card>
      ))}
      <div>
        <ApproveButton onClick={() => updateMutation.mutate({ data: values })} disabled={updateMutation.isPending}>
          저장하기
        </ApproveButton>
      </div>
    </>
  );
}

export function AdminSettingsScreen() {
  const settingsQuery = generated.useGetAdminSettings();
  const settings = settingsQuery.data?.data;

  return (
    <>
      <AdminPageTitle>설정</AdminPageTitle>
      {settings ? <SettingsForm settings={settings} /> : <div style={{ padding: '24px 0', color: c.gray500 }}>불러오는 중...</div>}
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
