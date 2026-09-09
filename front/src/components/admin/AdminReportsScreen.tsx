'use client';

import {
  AdminPageTitle,
  FilterBar,
  SearchFilter,
  SelectFilter,
} from './parts';
import { ReportLogTable } from './ReportLogTable';

export function AdminReportsScreen() {
  return (
    <>
      <AdminPageTitle>신고 처리</AdminPageTitle>
      <FilterBar>
        <SearchFilter placeholder="기관명/담당자 검색" label="기관명/담당자 검색" />
        <SelectFilter label="기관유형" options={['비영리', '학교', '협회', '기업']} />
        <SelectFilter label="상태" options={['대기', '승인', '거부']} />
      </FilterBar>
      <ReportLogTable />
    </>
  );
}
