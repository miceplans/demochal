import { NotFound } from '@/apps/user/components/common/NotFound';
import { UserShell } from '@/apps/user/components/common/UserShell';

export default function RootNotFound() {
  return (
    <UserShell>
      <NotFound homeHref="/" />
    </UserShell>
  );
}
