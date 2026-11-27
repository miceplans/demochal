'use client';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { MyShell } from '@/components/common/UserShell';
import { DesktopOnly, Stack, Title, Muted, Toggle } from '@/components/common/Primitives';
import { notificationSettings } from '@/data/user-design';
import { generated } from '@semochal/api-client';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { useAuth } from '@/features/auth/AuthProvider';

const notificationSettingKeys = notificationSettings.flatMap((g) => g.rows.map(([key]) => key));
export function NotificationSettingsPage() {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const saved = me?.notificationSettings;
  // 저장된 적 없는 키는 기본 on. 서버(users.notification_settings)가 유일한 기준값이다.
  const values: Record<string, boolean> = Object.fromEntries(
    notificationSettingKeys.map((key) => [key, saved?.[key] ?? true]),
  );
  const save = generated.useSaveNotificationSettings({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: generated.getGetMyAuthInfoQueryKey() }),
    },
  });
  const toggle = (key: string) => {
    // 서버 값을 받기 전이나 저장 중에는 이전 값 기준으로 덮어쓰지 않게 막는다.
    if (!me || save.isPending) return;
    save.mutate({
      data: Object.fromEntries(
        notificationSettingKeys.map((k) => [k, { enabled: k === key ? !values[k] : values[k] }]),
      ),
    });
  };
  return (
    <MyShell title="알림 설정">
      <Stack>
        <DesktopOnly>
          <Title>알림 설정</Title>
          <NotificationDescription>받고 싶은 알림을 선택하세요</NotificationDescription>
        </DesktopOnly>
        {notificationSettings.map((g) => (
          <SettingsGroup key={g.title}>
            <h2>{g.title}</h2>
            {g.rows.map(([key, label, desc]) => (
              <div key={key} className="setting">
                <div>
                  <SettingLabel>{label}</SettingLabel>
                  <SettingDescription>{desc}</SettingDescription>
                </div>
                <Toggle label={label} checked={values[key]} onChange={() => toggle(key)} />
              </div>
            ))}
          </SettingsGroup>
        ))}
      </Stack>
    </MyShell>
  );
}

// Styles are kept together at the bottom so page behavior and layout definitions remain separate.
const SettingsGroup = styled.section({
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 12,
  overflow: 'hidden',
  '& h2': { background: c.gray100, padding: '14px 20px', ...textStyle.body },
  '.setting': {
    padding: '16px 20px',
    display: 'flex',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTop: `0.5px solid ${c.gray100}`,
  },
  [mobile]: {
    border: 0,
    '& h2': { background: c.white, padding: '12px 0', fontWeight: 600 },
    '.setting': { padding: '16px 0' },
  },
});
const NotificationDescription = styled.p({ marginTop: 24 });
const SettingLabel = styled.p({ fontSize: 14, marginBottom: 4 });
const SettingDescription = styled(Muted)({ fontSize: 12 });
