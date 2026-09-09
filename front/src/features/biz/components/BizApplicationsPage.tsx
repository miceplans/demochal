'use client';
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
  StatusTag,
} from '@/components/biz/BizShell';
import { applications, postingStats, recentPosting } from '@/data/biz-design';

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

export function BizApplicationsPage() {
  return (
    <BizContent>
      <TopGrid>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 48, minWidth: 0 }}>
          <SectionHeader>
            <SectionTitle>신청서 응답 관리</SectionTitle>
            <OutlineButton type="button">필터</OutlineButton>
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
          <TableBox>
            <THead>
              <Col w={150}>팀명</Col>
              <Col w={150}>신청자</Col>
              <Col w={150}>신청 상태</Col>
              <Col w={300}>담당자 메모</Col>
              <Col w={120}>평가상태</Col>
            </THead>
            {applications.map((row) => (
              <TRow key={row.id}>
                <Col w={150}>{row.team}</Col>
                <Col w={150}>{row.applicant}</Col>
                <Col w={150}>{row.status}</Col>
                <Col w={300}>{row.memo}</Col>
                <Col w={120}>
                  <span style={{ color: row.result === '합격' ? c.green : row.result === '불합격' ? c.red : c.gray500 }}>
                    {row.result}
                  </span>
                </Col>
              </TRow>
            ))}
          </TableBox>
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
