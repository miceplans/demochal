import { ReportFormPage } from '@/components/reports/ReportFormPage';
import { RequireAuth } from '@/components/auth/RequireAuth';
export default function Page() {
  return (
    <RequireAuth>
      <ReportFormPage />
    </RequireAuth>
  );
}
