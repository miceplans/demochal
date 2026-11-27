'use client';
import { MyShell } from '@/components/common/UserShell';
import { ProfileEditor } from '../ProfileEditor';

export function MyProfileEditPage() {
  return (
    <MyShell title="내 프로필 수정">
      <ProfileEditor />
    </MyShell>
  );
}
