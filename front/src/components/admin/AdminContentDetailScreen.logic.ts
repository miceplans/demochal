const formatDateDot = (iso?: string) => (iso ? iso.slice(0, 10).replaceAll('-', '.') : '');
type ReportEntry = {
  id?: string;
  summary?: string;
  detail?: string | null;
  reporter?: string;
  reportedAt?: string;
  status?: string;
};

export type { ReportEntry };
export { formatDateDot };
export { daysUntil as daysLeft } from '@/utils/date';
