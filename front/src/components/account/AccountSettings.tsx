'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { MyShell } from '@/components/common/UserShell';
import { Button, Input, Stack, Title, Muted } from '@/components/common/Primitives';
import { adApi } from '@/lib/ad-api';
import { useUserStore } from '@/stores/useUserStore';

export function AccountSettings() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const clearClient = () => {
    queryClient.clear();
    useUserStore.getState().logout();
    useUserStore.persist.clearStorage();
  };
  const logout = async () => {
    await adApi.auth.logout();
    clearClient();
    router.replace('/login');
  };
  const withdraw = async () => {
    setError('');
    try {
      await adApi.auth.withdraw({ password, confirmation: '회원 탈퇴' });
      clearClient();
      router.replace('/login');
    } catch {
      setError('현재 비밀번호를 확인하거나, 팀장·기관 소유권을 먼저 이전해 주세요.');
    }
  };
  return (
    <MyShell title="계정 설정">
      <Stack gap={20} style={{ maxWidth: 520 }}>
        <Title>계정 설정</Title>
        <Button type="button" tone="plain" onClick={() => void logout()}>
          로그아웃
        </Button>
        <hr style={{ width: '100%', border: 0, borderTop: '1px solid #eee' }} />
        <Stack gap={10}>
          <Title style={{ fontSize: 20 }}>회원 탈퇴</Title>
          <Muted>
            탈퇴하면 개인정보는 삭제되고, 법적 보관이 필요한 거래·분쟁 기록만 보관됩니다. 팀장 또는
            기관 소유자는 권한을 이전한 뒤 탈퇴할 수 있습니다.
          </Muted>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="현재 비밀번호"
            aria-label="현재 비밀번호"
          />
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{' '}
            안내를 확인했고 회원 탈퇴에 동의합니다.
          </label>
          {error && <Muted style={{ color: '#d92d20' }}>{error}</Muted>}
          <Button
            type="button"
            tone="outline"
            disabled={!confirmed || password.length < 8}
            onClick={() => void withdraw()}
          >
            회원 탈퇴
          </Button>
        </Stack>
      </Stack>
    </MyShell>
  );
}
