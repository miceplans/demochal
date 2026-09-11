'use client';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  BizContent,
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
import { applications, postingStats, recentPosting } from '@/data/biz-design';

const TopRow = styled.div({ display: 'flex', gap: 24, alignItems: 'flex-start', width: '100%' });
const RegistrationBody = styled.div({
  flex: '1 0 0',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
});
const Thumb = styled.div({
  flex: '1 0 0',
  minHeight: 220,
  borderRadius: 18,
  background: c.gray100,
});
const HeaderInfo = styled.div({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 24,
  width: '100%',
});
const Badge = styled.div({ display: 'flex', gap: 9, ...textStyle.finePrint });
const BadgeLabel = styled.strong({ flexShrink: 0, color: c.gray900 });
const BadgeValue = styled.span({ color: c.gray700 });

const SideCol = styled.div({ width: 301, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 32 });
const ActionStack = styled.div({ display: 'flex', flexDirection: 'column', gap: 8 });
const StatStack = styled.div({ display: 'flex', flexDirection: 'column', gap: 16 });

const Col = ({ w, children }: { w?: number; children: React.ReactNode }) => (
  <span style={{ width: w, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
    {children}
  </span>
);

export function BizPostingManagePage() {
  const router = useRouter();
  const hrefOf = useBizHref();
  return (
    <BizContent>
      <TopRow>
        <RegistrationBody>
          <Thumb aria-hidden />
          <HeaderInfo>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <strong style={{ fontSize: 22, color: c.gray900 }}>{recentPosting.title}</strong>
              <span style={{ color: c.gray700, fontSize: 15 }}>{recentPosting.org}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
              <Badge>
                <BadgeLabel>자격 / 대상</BadgeLabel>
                <BadgeValue>{recentPosting.eligibility}</BadgeValue>
              </Badge>
              <Badge>
                <BadgeLabel>접수기간</BadgeLabel>
                <BadgeValue>{recentPosting.period}</BadgeValue>
              </Badge>
            </div>
          </HeaderInfo>
        </RegistrationBody>
        <SideCol>
          <ActionStack>
            <PrimaryButton
              style={{ height: 37, width: '100%' }}
              onClick={() => router.push(hrefOf(`/postings/${recentPosting.id}/form`))}
            >
              신청폼 만들기
            </PrimaryButton>
            <OutlineButton type="button" style={{ height: 37, width: '100%' }}>
              챌린지 편집하기
            </OutlineButton>
          </ActionStack>
          <StatStack>
            <StatBox style={{ flex: 1 }}>
              <span style={{ fontSize: 13, color: c.gray700 }}>클릭수</span>
              <StatValue>{postingStats.clicks.value}</StatValue>
              <Delta>{postingStats.clicks.delta}</Delta>
            </StatBox>
            <StatBox style={{ flex: 1 }}>
              <span style={{ fontSize: 13, color: c.gray700 }}>북마크</span>
              <StatValue>{postingStats.bookmarks.value}</StatValue>
              <Delta>{postingStats.bookmarks.delta}</Delta>
            </StatBox>
          </StatStack>
        </SideCol>
      </TopRow>

      <section aria-label="챌린지 지원현황" style={{ width: '100%' }}>
        <TableBox>
          <THead>
            <span style={{ display: 'flex', gap: 16 }}>
              <Col w={150}>팀명</Col>
              <Col w={150}>신청자</Col>
              <Col w={150}>신청 상태</Col>
            </span>
            <span style={{ display: 'flex', gap: 20 }}>
              <Col w={300}>담당자 메모</Col>
              <Col w={120}>평가상태</Col>
            </span>
          </THead>
          {applications.map((row) => (
            <TRow key={row.id}>
              <span style={{ display: 'flex', gap: 16 }}>
                <Col w={150}>{row.team}</Col>
                <Col w={150}>{row.applicant}</Col>
                <Col w={150}>{row.status}</Col>
              </span>
              <span style={{ display: 'flex', gap: 20 }}>
                <Col w={300}>{row.memo}</Col>
                <Col w={120}>
                  <span
                    style={{
                      color: row.result === '합격' ? c.green : row.result === '불합격' ? c.red : c.gray500,
                    }}
                  >
                    {row.result}
                  </span>
                </Col>
              </span>
            </TRow>
          ))}
        </TableBox>
      </section>
    </BizContent>
  );
}
