'use client';

import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  adminContests,
  adminTeams,
} from '@/data/admin-design';
import {
  AdminPageTitle,
  AdminSectionTitle,
  FilterBar,
  MoreLink,
  SearchFilter,
  SelectFilter,
  SectionHeader,
} from './parts';
import { ReportLogTable } from './ReportLogTable';

/* ---------- 팀 카드 ---------- */

const CardGrid = styled.div({
  display: 'flex',
  gap: 16,
  flexWrap: 'nowrap',
  overflowX: 'auto',
});
const TeamCard = styled.article({
  position: 'relative',
  flex: '0 0 calc((100% - 48px) / 4)',
  border: '1px solid #E0E0E0',
  borderRadius: 12,
  background: c.gray100,
  overflow: 'hidden',
});
const UnreadDot = styled.span({
  position: 'absolute',
  top: 10,
  right: 10,
  width: 10,
  height: 10,
  borderRadius: 24,
  background: c.primary,
  zIndex: 1,
});
const TeamCover = styled.div({
  height: 135,
  background: 'linear-gradient(135deg, #E2E6EC 0%, #EFF1F4 100%)',
});
const TeamBody = styled.div({
  background: c.white,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});
const TeamName = styled.strong({ ...textStyle.mNameLabel, color: c.gray900 });
const TeamChallenge = styled.span({ ...textStyle.mInfoText, color: c.gray500 });
const RoleBadges = styled.div({ display: 'flex', gap: 6, flexWrap: 'wrap' });
const RoleBadge = styled.span<{ active?: boolean }>(({ active }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px 8px',
  borderRadius: 4,
  ...textStyle.mBadgeText,
  background: active ? c.lightGreen : '#F5F5F5',
  color: active ? c.green : '#999999',
  border: active ? 'none' : '0.5px solid #E0E0E0',
}));
/* ---------- 챌린지 카드 ---------- */

const ContestCard = styled.article({
  position: 'relative',
  flex: '0 0 calc((100% - 48px) / 4)',
  border: '1px solid #E0E0E0',
  borderRadius: 12,
  background: c.gray100,
  overflow: 'hidden',
});
const ContestCover = styled.div({
  height: 189,
  background: 'linear-gradient(135deg, #DDE4EE 0%, #EDF1F6 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: c.gray500,
  ...textStyle.mInfoText,
});
const ContestBody = styled.div({
  background: c.white,
  padding: 14,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});
const ContestTitle = styled.strong({ ...textStyle.bodySmall2, color: c.gray900 });
const TagRow = styled.div({ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' });
const CategoryTag = styled.span({
  padding: '3px 8px',
  borderRadius: 4,
  background: c.gray100,
  color: c.gray700,
  ...textStyle.finePrint,
});
const DDay = styled.span({ ...textStyle.overline, color: c.primary });
const TeamCount = styled.span({
  padding: '4px 8px',
  borderRadius: 4,
  background: c.lightBlue,
  color: c.primary,
  ...textStyle.label,
});
const ScrapButton = styled.button({
  marginLeft: 'auto',
  border: 0,
  background: 'none',
  color: c.gray500,
  display: 'inline-flex',
  padding: 4,
});

/* ---------- 신고 테이블 ---------- */

function ScrapGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}

export function AdminContentsScreen() {
  return (
    <>
      <AdminPageTitle>콘텐츠 모니터링</AdminPageTitle>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionHeader>
          <AdminSectionTitle>확인해야하는 팀</AdminSectionTitle>
          <MoreLink>더보기 →</MoreLink>
        </SectionHeader>
        <CardGrid>
          {adminTeams.map((team) => (
            <TeamCard key={team.id}>
              {team.unread ? <UnreadDot aria-label="확인 필요" /> : null}
              <TeamCover />
              <TeamBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TeamName>{team.name}</TeamName>
                  <TeamChallenge>{team.challenge}</TeamChallenge>
                </div>
                <RoleBadges>
                  {team.roles.map((role) => (
                    <RoleBadge key={role} active>
                      {role}
                    </RoleBadge>
                  ))}
                  {team.otherRoles.map((role) => (
                    <RoleBadge key={role}>{role}</RoleBadge>
                  ))}
                </RoleBadges>
                <span style={{ ...textStyle.mInfoText, color: c.gray700 }}>{team.members}</span>
              </TeamBody>
            </TeamCard>
          ))}
        </CardGrid>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionHeader>
          <AdminSectionTitle>확인해야하는 챌린지</AdminSectionTitle>
          <MoreLink>더보기 →</MoreLink>
        </SectionHeader>
        <CardGrid>
          {adminContests.map((contest) => (
            <ContestCard key={contest.id}>
              {contest.unread ? <UnreadDot aria-label="확인 필요" /> : null}
              <ContestCover>공고 이미지</ContestCover>
              <ContestBody>
                <ContestTitle>{contest.title}</ContestTitle>
                <TagRow>
                  <CategoryTag>{contest.category}</CategoryTag>
                  <DDay>{contest.dday}</DDay>
                  <TeamCount>{contest.teams}</TeamCount>
                  <ScrapButton aria-label="스크랩">
                    <ScrapGlyph />
                  </ScrapButton>
                </TagRow>
              </ContestBody>
            </ContestCard>
          ))}
        </CardGrid>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FilterBar>
          <SearchFilter placeholder="콘텐츠명 검색" label="콘텐츠명 검색" />
          <SelectFilter label="종류" options={['챌린지', '팀 모집', '수상작']} />
        </FilterBar>
        <ReportLogTable />
      </section>
    </>
  );
}
