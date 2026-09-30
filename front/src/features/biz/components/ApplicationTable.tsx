'use client';

import styled from '@emotion/styled';
import type { Application } from '@semochal/api-client';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

export type ApplicationPatch = Parameters<
  typeof import('@/lib/ad-api').adApi.applications.update
>[1];

export const STATUS_LABEL: Record<Application['status'], string> = {
  pending: '대기',
  submitted: '제출 완료',
  reviewing: '검토중',
  needs_revision: '보완 요청',
  accepted: '합격',
  rejected: '불합격',
};
export const EVALUATION_LABEL: Record<Application['evaluation'], string> = {
  undecided: '미정',
  pass: '합격',
  fail: '불합격',
};

const STATUS_OPTIONS: DropdownOption[] = (
  ['submitted', 'reviewing', 'needs_revision', 'accepted', 'rejected'] as const
).map((value) => ({ value, label: STATUS_LABEL[value] }));
const EVALUATION_OPTIONS: DropdownOption[] = (['undecided', 'pass', 'fail'] as const).map(
  (value) => ({ value, label: EVALUATION_LABEL[value] }),
);

const Box = styled.div({
  width: '100%',
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 12,
  background: c.white,
});
const Row = styled.div({
  display: 'flex',
  alignItems: 'center',
  minHeight: 56,
  padding: '0 16px',
  gap: 16,
  ...textStyle.body,
  borderTop: `1px solid ${c.gray100}`,
});
const HeadRow = styled(Row)({
  minHeight: 48,
  borderTop: 0,
  borderRadius: '12px 12px 0 0',
  background: c.gray100,
  ...textStyle.bodyStrong,
});
const Cell = styled.span<{ w?: number }>(({ w }) => ({
  flex: w ? `0 0 ${w}px` : '1 1 0',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));
const MemoInput = styled.input({
  width: '100%',
  border: '1px solid transparent',
  borderRadius: 6,
  padding: '6px 8px',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  '&:hover': { background: c.gray50 },
  '&:focus': { outline: 'none', borderColor: c.gray300, background: c.white },
});
const Empty = styled.p({ margin: 0, padding: 24, textAlign: 'center', color: c.gray500 });

/** 지원서 관리 표 — 팀명 / 신청자 / 신청 상태 / 담당자 메모 / 평가상태 (Figma 20 Application Response Management). */
export function ApplicationTable({
  rows,
  onUpdate,
}: {
  rows: Application[];
  onUpdate: (id: string, patch: ApplicationPatch) => void;
}) {
  return (
    <Box>
      <HeadRow>
        <Cell w={150}>팀명</Cell>
        <Cell w={150}>신청자</Cell>
        <Cell w={150}>신청 상태</Cell>
        <Cell>담당자 메모</Cell>
        <Cell w={120}>평가상태</Cell>
      </HeadRow>
      {rows.length === 0 && <Empty>접수된 지원서가 없습니다.</Empty>}
      {rows.map((row) => (
        <Row key={row.id}>
          <Cell w={150}>{row.teammates.join(', ') || row.role || '—'}</Cell>
          <Cell w={150}>{row.userId.slice(0, 8)}</Cell>
          <Cell w={150}>
            <Dropdown
              options={STATUS_OPTIONS}
              aria-label={`${row.id} 신청 상태`}
              value={row.status === 'pending' ? undefined : row.status}
              placeholder={STATUS_LABEL.pending}
              size="S"
              onChange={(value) =>
                onUpdate(row.id, { status: value as Exclude<Application['status'], 'pending'> })
              }
            />
          </Cell>
          <Cell>
            <MemoInput
              aria-label={`${row.id} 담당자 메모`}
              defaultValue={row.managerMemo ?? ''}
              placeholder="메모 입력"
              onBlur={(event) => {
                if (event.target.value !== (row.managerMemo ?? '')) {
                  onUpdate(row.id, { managerMemo: event.target.value });
                }
              }}
            />
          </Cell>
          <Cell w={120}>
            <Dropdown
              options={EVALUATION_OPTIONS}
              aria-label={`${row.id} 평가상태`}
              value={row.evaluation}
              size="S"
              onChange={(value) =>
                onUpdate(row.id, { evaluation: value as Application['evaluation'] })
              }
            />
          </Cell>
        </Row>
      ))}
    </Box>
  );
}
