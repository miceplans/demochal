'use client';
import { useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  BizContent,
  SectionHeader,
  SectionTitle,
  PrimaryButton,
  OutlineButton,
  StatBox,
  StatValue,
  Delta,
  TableBox,
  THead,
  TRow,
  FieldSelect,
} from '@/components/biz/BizShell';
import { applications as initialApplications, postingStats, recentPosting, type BizApplication } from '@/data/biz-design';

const Hero = styled.div({
  height: 236,
  borderRadius: 12,
  background: `linear-gradient(120deg, ${c.gray100}, ${c.lightBlue})`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: c.gray500,
});
const TopGrid = styled.div({ display: 'flex', gap: 32, alignItems: 'flex-start' });
const HeaderInfo = styled.div({
  flex: 1,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 24,
  minWidth: 0,
});
const Side = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  width: 321,
  flexShrink: 0,
});
const SideActions = styled.div({ display: 'flex', flexDirection: 'column', gap: 8 });
const Col = ({ w, children }: { w?: number; children: React.ReactNode }) => (
  <span
    style={{
      width: w,
      flexShrink: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

const FilterRow = styled.div({ display: 'flex', gap: 8, flexWrap: 'wrap' });
const FilterChip = styled.button<{ active?: boolean }>(({ active }) => ({
  border: `1px solid ${active ? c.primary : c.gray200}`,
  borderRadius: 999,
  background: active ? c.lightBlue : c.white,
  color: active ? c.primary : c.gray700,
  padding: '6px 14px',
  ...textStyle.finePrint,
  whiteSpace: 'nowrap',
}));
const RowSelect = styled(FieldSelect)({ height: 32, padding: '0 8px', width: '100%' });
const MemoInput = styled.input({
  width: '100%',
  border: '1px solid transparent',
  borderRadius: 6,
  padding: '6px 8px',
  background: 'transparent',
  color: 'inherit',
  '&:hover': { background: c.gray50 },
  '&:focus': { outline: 'none', borderColor: c.gray300, background: c.white },
});
const ResultSelect = styled(RowSelect)<{ result: BizApplication['result'] }>(({ result }) => ({
  color: result === '합격' ? c.green : result === '불합격' ? c.red : c.gray700,
  fontWeight: 600,
}));

const STATUS_FILTERS: Array<BizApplication['status'] | '전체'> = ['전체', '제출 완료', '검토중', '보완 요청'];
const STATUS_OPTIONS: BizApplication['status'][] = ['제출 완료', '검토중', '보완 요청'];
const RESULT_OPTIONS: BizApplication['result'][] = ['미정', '합격', '불합격'];

export function BizApplicationsPage() {
  const [rows, setRows] = useState<BizApplication[]>(initialApplications);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>('전체');

  const updateRow = (id: string, patch: Partial<BizApplication>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const filteredRows = useMemo(
    () => (filter === '전체' ? rows : rows.filter((row) => row.status === filter)),
    [rows, filter],
  );

  return (
    <BizContent>
      <TopGrid>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 48, minWidth: 0 }}>
          <SectionHeader>
            <SectionTitle>지원서 관리</SectionTitle>
            <OutlineButton type="button">내보내기</OutlineButton>
          </SectionHeader>
          <Hero aria-hidden>2025 공공데이터 활용 창업 대회 배너</Hero>
          <HeaderInfo>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              <strong style={{ fontSize: 22 }}>{recentPosting.title}</strong>
              <span style={{ color: c.gray700 }}>
                {recentPosting.org} · {recentPosting.period}
              </span>
            </div>
            <SideActions>
              <PrimaryButton>신청폼 만들기</PrimaryButton>
              <OutlineButton type="button">챌린지 편집하기</OutlineButton>
            </SideActions>
          </HeaderInfo>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FilterRow role="tablist" aria-label="신청 상태 필터">
              {STATUS_FILTERS.map((status) => (
                <FilterChip
                  key={status}
                  type="button"
                  role="tab"
                  aria-selected={filter === status}
                  active={filter === status}
                  onClick={() => setFilter(status)}
                >
                  {status}
                  {status !== '전체' && ` (${rows.filter((r) => r.status === status).length})`}
                </FilterChip>
              ))}
            </FilterRow>
            <TableBox>
              <THead>
                <Col w={150}>팀명</Col>
                <Col w={150}>신청자</Col>
                <Col w={150}>신청 상태</Col>
                <Col w={300}>담당자 메모</Col>
                <Col w={120}>평가상태</Col>
              </THead>
              {filteredRows.length === 0 ? (
                <TRow>
                  <span style={{ color: c.gray500, width: '100%', textAlign: 'center' }}>
                    해당하는 지원서가 없습니다.
                  </span>
                </TRow>
              ) : (
                filteredRows.map((row) => (
                  <TRow key={row.id}>
                    <Col w={150}>{row.team}</Col>
                    <Col w={150}>{row.applicant}</Col>
                    <span style={{ width: 150, flexShrink: 0 }}>
                      <RowSelect
                        aria-label={`${row.team} 신청 상태`}
                        value={row.status}
                        onChange={(e) => updateRow(row.id, { status: e.target.value as BizApplication['status'] })}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </RowSelect>
                    </span>
                    <span style={{ width: 300, flexShrink: 0 }}>
                      <MemoInput
                        aria-label={`${row.team} 담당자 메모`}
                        value={row.memo}
                        placeholder="메모 입력"
                        onChange={(e) => updateRow(row.id, { memo: e.target.value })}
                      />
                    </span>
                    <span style={{ width: 120, flexShrink: 0 }}>
                      <ResultSelect
                        result={row.result}
                        aria-label={`${row.team} 평가상태`}
                        value={row.result}
                        onChange={(e) => updateRow(row.id, { result: e.target.value as BizApplication['result'] })}
                      >
                        {RESULT_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </ResultSelect>
                    </span>
                  </TRow>
                ))
              )}
            </TableBox>
          </div>
        </div>
        <Side>
          <StatBox>
            <span style={{ fontSize: 13, color: c.gray700 }}>클릭수</span>
            <StatValue>{postingStats.clicks.value}</StatValue>
            <Delta>{postingStats.clicks.delta}</Delta>
          </StatBox>
          <StatBox>
            <span style={{ fontSize: 13, color: c.gray700 }}>북마크</span>
            <StatValue>{postingStats.bookmarks.value}</StatValue>
            <Delta>{postingStats.bookmarks.delta}</Delta>
          </StatBox>
        </Side>
      </TopGrid>
    </BizContent>
  );
}
