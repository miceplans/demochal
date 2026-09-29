'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styled from '@emotion/styled';
import type { Application } from '@semochal/api-client';
import { adApi } from '@/lib/ad-api';
import { BizContent } from '@/components/biz/BizShell';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { ApplicationTable, EVALUATION_LABEL } from './ApplicationTable';

const FILTER_OPTIONS: DropdownOption[] = [
  { value: '', label: '전체' },
  ...(['undecided', 'pass', 'fail'] as const).map((value) => ({
    value,
    label: EVALUATION_LABEL[value],
  })),
];

export function BizApplicationsPage() {
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [evaluation, setEvaluation] = useState('');
  const requestVersions = useRef(new Map<string, number>());
  useEffect(() => {
    let cancelled = false;
    void adApi.applications
      .listManaged()
      .then((items) => {
        if (!cancelled) setRows(items);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
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
  const count = (predicate: (row: Application) => boolean) => rows.filter(predicate).length;
  const stats = [
    { label: '전체 응답 수', value: rows.length },
    { label: '제출 완료 수', value: count((r) => r.status !== 'pending') },
    { label: '검토 중', value: count((r) => r.status === 'reviewing') },
    { label: '선정', value: count((r) => r.status === 'accepted') },
    { label: '미선정', value: count((r) => r.status === 'rejected') },
  ];
  const filtered = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (!evaluation || row.evaluation === evaluation) &&
        (!term ||
          row.userId.toLowerCase().includes(term) ||
          row.teammates.some((name) => name.toLowerCase().includes(term))),
    );
  }, [rows, keyword, evaluation]);

  return (
    <BizContent style={{ gap: 48 }}>
      <PageHeading>지원서 관리</PageHeading>
      <Stats aria-label="지원 현황 요약">
        {stats.map((stat) => (
          <Stat key={stat.label}>
            <StatLabel>{stat.label}</StatLabel>
            <StatValue>{stat.value.toLocaleString()}</StatValue>
          </Stat>
        ))}
      </Stats>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
        <SectionHeading>팀 지원현황</SectionHeading>
        <Toolbar>
          <Search
            type="search"
            value={keyword}
            placeholder="신청자 또는 팀명 검색"
            aria-label="신청자 또는 팀명 검색"
            onChange={(event) => setKeyword(event.target.value)}
          />
          <div style={{ width: 140 }}>
            <Dropdown
              options={FILTER_OPTIONS}
              value={evaluation}
              placeholder="평가상태"
              aria-label="평가상태 필터"
              size="S"
              onChange={setEvaluation}
            />
          </div>
        </Toolbar>
        {loading && <Message>지원서를 불러오는 중입니다.</Message>}
        {error && <Message role="alert">지원서를 불러오거나 저장하지 못했습니다.</Message>}
        {!loading && <ApplicationTable rows={filtered} onUpdate={update} />}
      </section>
    </BizContent>
  );
}

const PageHeading = styled.h1({ margin: 0, fontSize: 40, fontWeight: 600, color: c.gray900 });
const Stats = styled.div({ display: 'flex', gap: 24 });
const Stat = styled.div({ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: 16 });
const StatLabel = styled.span({ ...textStyle.metaText, color: c.gray700 });
const StatValue = styled.strong({ fontSize: 24, fontWeight: 700, color: c.gray900 });
const SectionHeading = styled.h2({ margin: 0, ...textStyle.h1_2 });
const Toolbar = styled.div({ display: 'flex', justifyContent: 'space-between', gap: 16 });
const Search = styled.input({
  width: 300,
  height: 43,
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  padding: '0 16px',
  ...textStyle.metaText,
  '&:focus': { outline: 'none', borderColor: c.primary },
});
const Message = styled.p({ margin: 0, color: c.gray500 });
