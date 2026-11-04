const formatDateDot = (iso?: string) => (iso ? iso.slice(0, 10).replaceAll('-', '.') : '');
const daysLeft = (iso: string | undefined, now: number) =>
  iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86_400_000)) : 0;

type ReportEntry = {
  id?: string;
  summary?: string;
  detail?: string | null;
  reporter?: string;
  reportedAt?: string;
  status?: string;
};

export type { ReportEntry };
export { daysLeft, formatDateDot };
