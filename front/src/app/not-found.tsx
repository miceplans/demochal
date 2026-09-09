import { NotFound } from '@/components/common/NotFound';
import { UserShell } from '@/components/common/UserShell';

export default function RootNotFound() {
  return (
    <UserShell>
      <NotFound homeHref="/" />
    </UserShell>
  );
}
