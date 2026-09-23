'use client';

import { useEffect, useRef, useState } from 'react';
import type { Application } from '@semochal/api-client';
import { adApi } from '@/lib/ad-api';
import { BizContent, SectionTitle, TableBox, THead, TRow } from '@/components/biz/BizShell';

export function BizApplicationsPage() {
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Application['status'] | ''>('');
  const requestVersions = useRef(new Map<string, number>());
  useEffect(() => {
    void adApi.applications
      .listManaged(statusFilter ? { status: statusFilter } : undefined)
      .then(setRows)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [statusFilter]);
  const update = (id: string, body: Parameters<typeof adApi.applications.update>[1]) => {
    const version = (requestVersions.current.get(id) ?? 0) + 1;
    requestVersions.current.set(id, version);
    void adApi.applications
      .update(id, body)
      .then((updated) =>
        setRows((current) =>
          requestVersions.current.get(id) === version
            ? current.map((row) => (row.id === id ? { ...row, ...updated } : row))
            : current,
        ),
      )
      .catch(() => setError(true));
  };
  return (
    <BizContent>
      <SectionTitle>지원서 관리</SectionTitle>
      <label>
        상태 필터{' '}
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as Application['status'] | '')}
        >
          <option value="">전체</option>
          <option value="pending">대기</option>
          <option value="submitted">제출</option>
          <option value="reviewing">검토중</option>
          <option value="needs_revision">보완 요청</option>
          <option value="accepted">합격</option>
          <option value="rejected">불합격</option>
        </select>
      </label>
      {loading && <p>지원서를 불러오는 중입니다.</p>}
      {error && <p>지원서를 불러오지 못했습니다.</p>}
      {!loading && !error && rows.length === 0 && <p>접수된 지원서가 없습니다.</p>}
      {rows.length > 0 && (
        <TableBox>
          <THead>
            <span>지원서</span>
            <span>상태</span>
            <span>평가</span>
            <span>메모</span>
          </THead>
          {rows.map((row) => (
            <TRow key={row.id}>
              <span>{row.id}</span>
              <select
                value={row.status}
                onChange={(event) =>
                  update(row.id, {
                    status: event.target.value as Exclude<Application['status'], 'pending'>,
                  })
                }
              >
                <option value="pending" disabled>
                  대기
                </option>
                <option value="submitted">제출</option>
                <option value="reviewing">검토중</option>
                <option value="needs_revision">보완 요청</option>
                <option value="accepted">합격</option>
                <option value="rejected">불합격</option>
              </select>
              <select
                value={row.evaluation}
                onChange={(event) =>
                  update(row.id, { evaluation: event.target.value as Application['evaluation'] })
                }
              >
                <option value="undecided">미정</option>
                <option value="pass">합격</option>
                <option value="fail">불합격</option>
              </select>
              <input
                defaultValue={row.managerMemo ?? ''}
                onBlur={(event) => update(row.id, { managerMemo: event.target.value })}
                aria-label={`${row.id} 담당자 메모`}
              />
            </TRow>
          ))}
        </TableBox>
      )}
    </BizContent>
  );
}
