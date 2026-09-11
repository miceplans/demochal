'use client';

import { useState } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  adminSettingsDefaults,
  adminSettingsGroups,
  adminSettingsProfile,
} from '@/data/admin-design';
import { AdminPageTitle, ApproveButton } from './parts';
import { Toggle } from '@/components/common/Primitives';
import { useToast } from '@/components/common/Toast';

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

export function AdminSettingsScreen() {
  const [values, setValues] = useState(adminSettingsDefaults);
  const toast = useToast();
  return (
    <>
      <AdminPageTitle>설정</AdminPageTitle>
      <Card aria-label="관리자 계정 정보">
        <CardTitle>계정 정보</CardTitle>
        {adminSettingsProfile.map(([label, value]) => (
          <ProfileRow key={label}>
            <ProfileLabel>{label}</ProfileLabel>
            <strong>{value}</strong>
          </ProfileRow>
        ))}
      </Card>
      {adminSettingsGroups.map((group) => (
        <Card key={group.title} aria-label={group.title}>
          <CardTitle>{group.title}</CardTitle>
          {group.rows.map(([key, label, desc]) => (
            <SettingRow key={key}>
              <SettingText>
                <SettingLabel>{label}</SettingLabel>
                <SettingDesc>{desc}</SettingDesc>
              </SettingText>
              <Toggle
                label={label}
                checked={values[key]}
                onChange={() => setValues((v) => ({ ...v, [key]: !v[key] }))}
              />
            </SettingRow>
          ))}
        </Card>
      ))}
      <div>
        <ApproveButton onClick={() => toast.success('설정을 저장했어요')}>저장하기</ApproveButton>
      </div>
    </>
  );
}
