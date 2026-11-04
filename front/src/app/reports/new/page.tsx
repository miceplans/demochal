import { ReportFormPage } from '@/apps/user/components/reports/ReportFormPage';
import { RequireAuth } from '@/apps/user/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <ReportFormPage />
    </RequireAuth>
  );
}
