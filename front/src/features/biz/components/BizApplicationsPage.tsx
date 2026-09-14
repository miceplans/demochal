'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
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
  useBizHref,
} from '@/components/biz/BizShell';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
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
const Side = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
  width: 321,
  flexShrink: 0,
});
const SideActions = styled.div({ display: 'flex', flexDirection: 'column', gap: 8 });
const StatStack = styled.div({ display: 'flex', flexDirection: 'column', gap: 16 });
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

const STATUS_FILTERS: Array<BizApplication['status'] | '전체'> = ['전체', '제출 완료', '검토중', '보완 요청'];
const STATUS_OPTIONS: BizApplication['status'][] = ['제출 완료', '검토중', '보완 요청'];
const RESULT_OPTIONS: BizApplication['result'][] = ['미정', '합격', '불합격'];
const FILTER_OPTIONS: DropdownOption[] = STATUS_FILTERS.map((s) => ({ value: s, label: s }));
const STATUS_DROPDOWN_OPTIONS: DropdownOption[] = STATUS_OPTIONS.map((s) => ({ value: s, label: s }));
const RESULT_DROPDOWN_OPTIONS: DropdownOption[] = RESULT_OPTIONS.map((r) => ({ value: r, label: r }));

export function BizApplicationsPage() {
  const router = useRouter();
  const hrefOf = useBizHref();
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
      <SectionHeader>
        <SectionTitle>지원서 관리</SectionTitle>
        <OutlineButton type="button">내보내기</OutlineButton>
      </SectionHeader>
      <Hero aria-hidden>2025 공공데이터 활용 창업 대회 배너</Hero>
      <TopGrid>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <strong style={{ fontSize: 22 }}>{recentPosting.title}</strong>
          <span style={{ color: c.gray700 }}>
            {recentPosting.org} · {recentPosting.period}
          </span>
        </div>
        <Side>
          <SideActions>
            <PrimaryButton onClick={() => router.push(hrefOf(`/postings/${recentPosting.id}/form`))}>
              신청폼 만들기
            </PrimaryButton>
            <OutlineButton type="button" onClick={() => router.push(hrefOf(`/postings/${recentPosting.id}`))}>
              챌린지 편집하기
            </OutlineButton>
          </SideActions>
          <StatStack>
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
          </StatStack>
        </Side>
      </TopGrid>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
        <div style={{ width: 180 }}>
          <Dropdown
            options={FILTER_OPTIONS}
            value={filter}
            placeholder="상태별 보기"
            aria-label="상태별 보기"
            size="S"
            onChange={(value) => setFilter(value as (typeof STATUS_FILTERS)[number])}
          />
        </div>
        <TableBox style={{ overflow: 'visible' }}>
          <THead style={{ borderRadius: '12px 12px 0 0' }}>
            <Col w={150}>팀명</Col>
            <Col w={150}>신청자</Col>
            <Col w={150}>신청 상태</Col>
            <Col w={300}>담당자 메모</Col>
            <Col w={120}>평가상태</Col>
          </THead>
          {filteredRows.length === 0 ? (
            <TRow style={{ borderRadius: '0 0 12px 12px' }}>
              <span style={{ color: c.gray500, width: '100%', textAlign: 'center' }}>
                해당하는 지원서가 없습니다.
              </span>
            </TRow>
          ) : (
            filteredRows.map((row, index) => (
              <TRow
                key={row.id}
                style={index === filteredRows.length - 1 ? { borderRadius: '0 0 12px 12px' } : undefined}
              >
                <Col w={150}>{row.team}</Col>
                <Col w={150}>{row.applicant}</Col>
                <span style={{ width: 150, flexShrink: 0 }}>
                  <Dropdown
                    options={STATUS_DROPDOWN_OPTIONS}
                    aria-label={`${row.team} 신청 상태`}
                    value={row.status}
                    size="S"
                    onChange={(value) => updateRow(row.id, { status: value as BizApplication['status'] })}
                  />
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
                  <Dropdown
                    options={RESULT_DROPDOWN_OPTIONS}
                    aria-label={`${row.team} 평가상태`}
                    value={row.result}
                    size="S"
                    onChange={(value) => updateRow(row.id, { result: value as BizApplication['result'] })}
                  />
                </span>
              </TRow>
            ))
          )}
        </TableBox>
      </div>
    </BizContent>
  );
}
