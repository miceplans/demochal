import { NotFound } from '@/apps/user/components/common/NotFound';
import { UserShell } from '@/apps/user/layouts/UserShell';

export default function RootNotFound() {
  return (
    <UserShell>
      <NotFound homeHref="/" />
    </UserShell>
  );
}
