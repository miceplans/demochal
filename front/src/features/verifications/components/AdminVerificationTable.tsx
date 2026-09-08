'use client';

import type { ColumnDef } from '@tanstack/react-table';
import styled from '@emotion/styled';
import { DataTable } from '@/components/data/DataTable';
import { textStyle } from '@/styles/typography';

// 관리자 검증 요청 예시 데이터 — 실제 데이터는 verifications API 연동 시 교체 (TODO).
interface VerificationRow {
  id: string;
  businessName: string;
  registrationNumber: string;
  status: 'pending' | 'processing' | 'verified' | 'rejected';
  createdAt: string;
}

const statusLabel: Record<VerificationRow['status'], string> = {
  pending: '대기중',
  processing: '검증중',
  verified: '승인',
  rejected: '반려',
};

const Badge = styled.span<{ status: VerificationRow['status'] }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: ${textStyle.overline.fontSize}px;
  font-weight: ${textStyle.overline.fontWeight};
  background: ${(p) => {
    switch (p.status) {
      case 'verified':
        return p.theme.colors.lightGreen;
      case 'rejected':
        return p.theme.colors.lightRed;
      default:
        return p.theme.colors.lightBlue;
    }
  }};
  color: ${(p) => {
    switch (p.status) {
      case 'verified':
        return p.theme.colors.green;
      case 'rejected':
        return p.theme.colors.red;
      default:
        return p.theme.colors.semo;
    }
  }};
`;

const columns: ColumnDef<VerificationRow, unknown>[] = [
  { accessorKey: 'businessName', header: '사업자명' },
  { accessorKey: 'registrationNumber', header: '사업자등록번호' },
  {
    accessorKey: 'status',
    header: '상태',
    cell: (info) => {
      const status = info.getValue() as VerificationRow['status'];
      return <Badge status={status}>{statusLabel[status]}</Badge>;
    },
  },
  {
    accessorKey: 'createdAt',
    header: '신청일',
    cell: (info) => new Date(info.getValue() as string).toLocaleDateString('ko-KR'),
  },
];

const mockRows: VerificationRow[] = [
  {
    id: 'ver-1',
    businessName: '세모카페',
    registrationNumber: '123-45-67890',
    status: 'pending',
    createdAt: '2026-09-01T09:00:00.000Z',
  },
  {
    id: 'ver-2',
    businessName: '세모제과',
    registrationNumber: '234-56-78901',
    status: 'processing',
    createdAt: '2026-09-02T11:30:00.000Z',
  },
  {
    id: 'ver-3',
    businessName: '세모마켓',
    registrationNumber: '345-67-89012',
    status: 'verified',
    createdAt: '2026-09-03T14:00:00.000Z',
  },
  {
    id: 'ver-4',
    businessName: '세모서점',
    registrationNumber: '456-78-90123',
    status: 'rejected',
    createdAt: '2026-09-04T16:45:00.000Z',
  },
];

// 관리자: 사업자등록증 검증 현황 테이블 (TanStack Table 예시).
export function AdminVerificationTable() {
  return <DataTable data={mockRows} columns={columns} />;
}
