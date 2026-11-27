import { BookmarksPage } from '@/components/my/pages/BookmarksPage';
import { RequireAuth } from '@/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <BookmarksPage />
    </RequireAuth>
  );
}
