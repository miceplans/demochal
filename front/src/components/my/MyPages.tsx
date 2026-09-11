'use client';
import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { UserShell, Content, MyShell, myMenu } from '@/components/common/UserShell';
import {
  Button,
  Chip,
  DesktopOnly,
  MobileOnly,
  Row,
  Stack,
  Wrap,
  Title,
  Heading,
  Muted,
  Tag,
  Toggle,
  Input,
  Icon,
} from '@/components/common/Primitives';
import { Dropdown } from '@/components/ui/Dropdown';
import { Modal } from '@/components/common/Feedback';
import { Identity, Badges, SkillStack, History, AddButton } from '@/components/profile/ProfileCards';
import { ContestCard, ContestGrid } from '@/components/contests/ContestCard';
import {
  contests,
  desktopContests,
  preferenceGroups,
  notificationSettings,
  participatingTeams,
  contestApplications,
  teamApplications,
  teamApplicants,
  notificationItems,
  notificationTabs,
  contestDetail,
  stacks,
  skillCatalog,
} from '@/data/user-design';
import { useUserStore } from '@/stores/useUserStore';
import { useToast } from '@/components/common/Toast';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import legalCopy from '@/data/design-copy.json';

const MobileMenu = styled.nav({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  '& a': {
    padding: '16px 8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 600,
    borderRadius: 8,
    transition: 'background 0.15s ease',
  },
  '& a:active': { background: c.gray50 },
  '& a:hover span': { transform: 'translateX(3px)' },
  '& a span': { display: 'inline-block', transition: 'transform 0.15s ease' },
  borderBottom: `1px solid ${c.gray100}`,
  paddingBottom: 24,
});
const Participating = styled.div({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 20,
  '& a': {
    border: `1px solid ${c.gray100}`,
    borderRadius: 12,
    padding: 16,
    transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease',
    '&:hover': {
      transform: 'translateY(-3px)',
      borderColor: c.gray200,
      boxShadow: '0 8px 20px rgb(0 0 0 / 8%)',
    },
  },
  [mobile]: { gridTemplateColumns: '1fr' },
});
const UploadBox = styled.label({
  border: `2px dashed ${c.gray100}`,
  background: '#f8f8f8',
  borderRadius: 12,
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minHeight: 110,
  ...textStyle.metaText,
  color: c.gray500,
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 0.15s ease, background 0.15s ease, transform 0.1s ease',
  '&:hover': { borderColor: c.gray300 },
  '&:active': { transform: 'scale(0.99)' },
});
const HiddenInput = styled.input({
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
});
const UploadMark = styled.img({ width: 40, height: 26 });
const SkillGrid = styled(Wrap)({ maxHeight: 220, overflowY: 'auto', alignItems: 'flex-start' });
const certificateBadges = ['자격증', '수료증', '어학성적', '수상경력'];

function CertificateModal({
  open,
  onClose,
  onVerified,
}: {
  open: boolean;
  onClose: () => void;
  onVerified: (label: string) => void;
}) {
  const toast = useToast();
  const [badge, setBadge] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFileName(file.name);
  };
  const reset = () => {
    setBadge(null);
    setFileName(null);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!badge) return;
    onVerified(badge);
    reset();
    onClose();
    toast.success('자격증 인증 요청을 보냈어요', '검토가 끝나면 뱃지가 표시돼요');
  };
  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="자격증 인증"
    >
      <form onSubmit={submit}>
        <Stack gap={12}>
          <Wrap>
            {certificateBadges.map((x) => (
              <Chip
                key={x}
                type="button"
                selected={badge === x}
                aria-pressed={badge === x}
                onClick={() => setBadge(x)}
              >
                {x}
              </Chip>
            ))}
          </Wrap>
          <UploadBox aria-label="증명 파일 첨부">
            <UploadMark src="/assets/icons/fileuploader.png" alt="" aria-hidden />
            {fileName ?? '증명 파일 첨부 (이미지, PDF)'}
            <HiddenInput type="file" accept="image/*,.pdf" onChange={pickFile} required />
          </UploadBox>
          <Row style={{ justifyContent: 'flex-end', marginTop: 4 }}>
            <Button type="button" small tone="plain" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" small disabled={!badge}>
              인증 요청
            </Button>
          </Row>
        </Stack>
      </form>
    </Modal>
  );
}

function SkillAddModal({
  open,
  onClose,
  existing,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  existing: string[];
  onAdd: (skills: string[]) => void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const options = useMemo(
    () =>
      skillCatalog.filter(
        (x) => !existing.includes(x) && x.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query, existing],
  );
  const close = () => {
    setQuery('');
    setPicked([]);
    onClose();
  };
  const togglePick = (skill: string) =>
    setPicked((s) => (s.includes(skill) ? s.filter((x) => x !== skill) : [...s, skill]));
  return (
    <Modal open={open} onClose={close} title="기술 스택 추가" width={420}>
      <Input
        aria-label="기술 검색"
        placeholder="기술 이름으로 검색하세요"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <SkillGrid>
        {options.map((skill) => (
          <Chip
            key={skill}
            type="button"
            selected={picked.includes(skill)}
            aria-pressed={picked.includes(skill)}
            onClick={() => togglePick(skill)}
          >
            {skill}
          </Chip>
        ))}
        {options.length === 0 && <Muted>검색 결과가 없어요.</Muted>}
      </SkillGrid>
      <Row style={{ justifyContent: 'flex-end', marginTop: 4 }}>
        <Button type="button" small tone="plain" onClick={close}>
          취소
        </Button>
        <Button
          type="button"
          small
          disabled={picked.length === 0}
          onClick={() => {
            onAdd(picked);
            toast.success(`기술 ${picked.length}개를 추가했어요`);
            close();
          }}
        >
          추가하기{picked.length > 0 ? ` (${picked.length})` : ''}
        </Button>
      </Row>
    </Modal>
  );
}

export function MyPage() {
  const [certOpen, setCertOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  const [certificates, setCertificates] = useState<string[]>([]);
  const [mySkills, setMySkills] = useState<string[]>(stacks);
  return (
    <MyShell title="MY">
      <Stack gap={28}>
        <Link href="/profile">
          <Identity large />
        </Link>
        <DesktopOnly>
          <Heading style={{ marginBottom: 12 }}>내 뱃지</Heading>
        </DesktopOnly>
        <Badges
          extra={certificates}
          trailing={
            <AddButton aria-label="자격증 인증하기" onClick={() => setCertOpen(true)}>
              <Icon name="imgAddSlotIc" size={12} />
            </AddButton>
          }
        />
        <MobileOnly>
          <MobileMenu>
            {myMenu.map(([href, label]) => (
              <Link key={href} href={href}>
                {label}
                <span style={{ fontSize: 14 }}>›</span>
              </Link>
            ))}
          </MobileMenu>
        </MobileOnly>
        <Heading>기술 스택</Heading>
        <SkillStack
          skills={mySkills}
          trailing={
            <AddButton aria-label="기술 스택 추가하기" onClick={() => setSkillOpen(true)}>
              <Icon name="imgAddSlotIc" size={12} />
            </AddButton>
          }
        />
        <DesktopOnly>
          <Heading style={{ marginBottom: 24 }}>참여중</Heading>
          <Participating>
            {participatingTeams.map((team) => (
              <Link key={team.id} href={team.href}>
                <Heading>{team.challenge}</Heading>
                <Muted>{team.description}</Muted>
                <Wrap style={{ margin: '20px 0' }}>
                  {team.filledRoles.map((role) => (
                    <Tag key={role} tone="blue">
                      {role}
                    </Tag>
                  ))}
                  {team.recruitingRoles.map((role) => (
                    <Tag key={role}>{role}</Tag>
                  ))}
                </Wrap>
                <Muted>
                  {team.dday} · {team.deadline}
                </Muted>
              </Link>
            ))}
          </Participating>
        </DesktopOnly>
        <MobileOnly>
          <Heading style={{ marginBottom: 12 }}>참가 이력</Heading>
          <History compact />
        </MobileOnly>
      </Stack>
      <CertificateModal
        open={certOpen}
        onClose={() => setCertOpen(false)}
        onVerified={(label) =>
          setCertificates((prev) => (label && !prev.includes(label) ? [...prev, label] : prev))
        }
      />
      <SkillAddModal
        open={skillOpen}
        onClose={() => setSkillOpen(false)}
        existing={mySkills}
        onAdd={(skills) => setMySkills((prev) => [...prev, ...skills.filter((s) => !prev.includes(s))])}
      />
    </MyShell>
  );
}
export function MyTeamsPage() {
  return (
    <MyShell title="내 팀">
      <Stack>
        <Title>내가 만든 팀이 있는 챌린지</Title>
        <ContestGrid style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
          {desktopContests.slice(0, 2).map((x) => (
            <ContestCard contest={x} key={x.id} href="/my/teams/public-data" />
          ))}
        </ContestGrid>
      </Stack>
    </MyShell>
  );
}
const BookmarkGrid = styled(ContestGrid)<{ two: boolean }>(({ two }) => ({
  gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
  [mobile]: { gridTemplateColumns: two ? 'repeat(2,minmax(0,1fr))' : '1fr' },
}));
export function BookmarksPage() {
  const ids = useUserStore((s) => s.bookmarks);
  const [sort, setSort] = useState('마감임박');
  const [two, setTwo] = useState(false);
  const data = contests
    .filter((x) => ids.includes(x.id))
    .sort((a, b) =>
      sort === '인기'
        ? b.teams - a.teams
        : sort === '최신'
          ? b.id.localeCompare(a.id)
          : a.days - b.days,
    );
  return (
    <MyShell title="북마크 챌린지">
      <Stack>
        <DesktopOnly>
          <Title>북마크 챌린지</Title>
        </DesktopOnly>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Row>
            {['마감임박', '최신', '인기'].map((x) => (
              <Button
                key={x}
                tone="plain"
                small
                aria-pressed={sort === x}
                style={{ color: sort === x ? c.primary : c.gray500, border: 0, padding: 0 }}
                onClick={() => setSort(x)}
              >
                {x}
              </Button>
            ))}
          </Row>
          <MobileOnly>
            <Button small tone="plain" aria-pressed={two} onClick={() => setTwo(!two)}>
              {two ? '1 열 보기' : '2 열 보기'}
            </Button>
          </MobileOnly>
        </Row>
        <BookmarkGrid two={two}>
          {data.map((x) => (
            <ContestCard key={x.id} contest={x} />
          ))}
        </BookmarkGrid>
        {data.length === 0 && <Muted>북마크한 챌린지가 없어요.</Muted>}
      </Stack>
    </MyShell>
  );
}
export function InterestsPage() {
  const state = useUserStore();
  const toast = useToast();
  return (
    <MyShell title="관심분야 설정">
      <Stack gap={24}>
        <DesktopOnly>
          <Title>관심분야 설정</Title>
        </DesktopOnly>
        <p style={{ fontSize: 15 }}>
          관심 있는 분야를 선택하면 맞춤 챌린지와 팀 모집을 추천해드려요
        </p>
        {preferenceGroups.map((g) => (
          <Stack key={g.key} gap={12}>
            <Heading>{g.title}</Heading>
            <Wrap style={{ maxWidth: 550 }}>
              {g.options.map((x) => (
                <Chip
                  key={x}
                  selected={state[g.key].includes(x)}
                  aria-pressed={state[g.key].includes(x)}
                  onClick={() => state.togglePreference(g.key, x)}
                >
                  {x}
                </Chip>
              ))}
            </Wrap>
          </Stack>
        ))}
        <Button style={{ width: 160 }} onClick={() => toast.success('관심분야를 저장했어요')}>
          저장하기
        </Button>
      </Stack>
    </MyShell>
  );
}
const SettingsGroup = styled.section({
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  overflow: 'hidden',
  '& h2': { background: c.gray100, padding: '14px 20px', ...textStyle.body },
  '.setting': {
    padding: '16px 20px',
    display: 'flex',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTop: `1px solid ${c.gray100}`,
  },
  [mobile]: {
    border: 0,
    '& h2': { background: c.white, padding: '12px 0', fontWeight: 600 },
    '.setting': { padding: '16px 0' },
  },
});
export function NotificationSettingsPage() {
  const values = useUserStore((s) => s.notifications);
  const toggle = useUserStore((s) => s.toggleNotification);
  return (
    <MyShell title="알림 설정">
      <Stack>
        <DesktopOnly>
          <Title>알림 설정</Title>
          <p style={{ marginTop: 24 }}>받고 싶은 알림을 선택하세요</p>
        </DesktopOnly>
        {notificationSettings.map((g) => (
          <SettingsGroup key={g.title}>
            <h2>{g.title}</h2>
            {g.rows.map(([key, label, desc]) => (
              <div key={key} className="setting">
                <div>
                  <p style={{ fontSize: 14, marginBottom: 4 }}>{label}</p>
                  <Muted style={{ fontSize: 12 }}>{desc}</Muted>
                </div>
                <Toggle label={label} checked={values[key]} onChange={() => toggle(key)} />
              </div>
            ))}
          </SettingsGroup>
        ))}
      </Stack>
    </MyShell>
  );
}
const Table = styled.table({
  width: '100%',
  borderSpacing: 0,
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  ...textStyle.bodySmall,
  '& th': { background: c.gray100, textAlign: 'left', fontWeight: 500 },
  '& td, & th': { padding: '14px 16px', borderBottom: `1px solid ${c.gray100}` },
  '& th:first-child': { borderRadius: '11px 0 0 0' },
  '& th:last-child': { borderRadius: '0 11px 0 0' },
  '& tr:last-child td:first-child': { borderRadius: '0 0 0 11px' },
  '& tr:last-child td:last-child': { borderRadius: '0 0 11px 0' },
  '& tbody tr': { transition: 'background 0.12s ease' },
  '& tbody tr:hover': { background: c.gray50 },
  [mobile]: { '& td, & th': { padding: 10, fontSize: textStyle.mInfoText.fontSize } },
});
export function ApplicationsPage() {
  return (
    <MyShell title="지원현황">
      <Stack gap={40}>
        <section>
          <Title style={{ marginBottom: 20 }}>챌린지 지원 현황</Title>
          <Table>
            <thead>
              <tr>
                <th>챌린지</th>
                <th>협회</th>
                <th>결과</th>
              </tr>
            </thead>
            <tbody>
              {contestApplications.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={row.href}>{row.contest}</Link>
                  </td>
                  <td>{row.org}</td>
                  <td>
                    <Tag
                      tone={row.result === '예선 통과' ? 'green' : row.result === '심사중' ? 'blue' : 'red'}
                    >
                      {row.result}
                    </Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
        <section>
          <Title style={{ marginBottom: 20 }}>팀 지원현황</Title>
          <Table>
            <thead>
              <tr>
                <th>챌린지</th>
                <th>팀</th>
                <th>결과</th>
              </tr>
            </thead>
            <tbody>
              {teamApplications.map((row) => (
                <tr key={row.id}>
                  <td>{row.contest}</td>
                  <td>{row.team}</td>
                  <td>
                    <Tag
                      tone={row.result === '확정' ? 'blue' : row.result === '검토중' ? 'green' : 'red'}
                    >
                      {row.result}
                    </Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      </Stack>
    </MyShell>
  );
}
const applicantResultOptions = ['미정', '합격', '불합격'].map((x) => ({
  value: x,
  label: x,
}));
export function TeamApplicantsPage() {
  const [results, setResults] = useState<string[]>(teamApplicants.map(() => '미정'));
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState('');
  const toast = useToast();
  return (
    <MyShell title="팀 지원현황">
      <Stack gap={28}>
        <div style={{ height: 220, borderRadius: 20, background: c.gray100 }} />
        <div>
          <Title>{contestDetail.title}</Title>
          <Muted style={{ marginTop: 8 }}>{contestDetail.org}</Muted>
        </div>
        <Row style={{ justifyContent: 'space-between', marginTop: 32 }}>
          <Heading>팀 지원현황</Heading>
          <Button small onClick={() => setOpen(true)}>
            결과 전송하기
          </Button>
        </Row>
        <Table>
          <thead>
            <tr>
              <th>이름</th>
              <th>뱃지</th>
              <th>결과</th>
            </tr>
          </thead>
          <tbody>
            {teamApplicants.map((applicant, i) => (
              <tr key={applicant.id}>
                <td>
                  <Link href={applicant.href}>{applicant.name}</Link>
                </td>
                <td>
                  <Wrap style={{ gap: 6 }}>
                    {applicant.badges.map((badge) => (
                      <Tag key={badge} tone="blue">
                        {badge}
                      </Tag>
                    ))}
                  </Wrap>
                </td>
                <td style={{ width: 130 }}>
                  <Dropdown
                    aria-label={`${applicant.name} 결과`}
                    size="S"
                    value={results[i]}
                    onChange={(x) => setResults(results.map((y, j) => (j === i ? x : y)))}
                    options={applicantResultOptions}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Stack>
      <Modal open={open} onClose={() => setOpen(false)} title="결과 전송하기">
        <Muted style={{ color: c.red }}>*이 활동은 되돌릴 수 없어요</Muted>
        <p style={{ fontSize: 13 }}>합격자들에게 전송할 채팅방 링크를 첨부해주세요.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
            toast.info('결과 전송 화면을 확인했어요', '실제 전송은 연결 후 사용할 수 있어요');
          }}
        >
          <Input
            aria-label="채팅방 링크"
            placeholder="링크"
            type="url"
            required
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <Row style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <Button type="button" small tone="plain" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" small>
              확인
            </Button>
          </Row>
        </form>
      </Modal>
    </MyShell>
  );
}

const NotificationList = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  borderTop: `1px solid ${c.gray100}`,
});
const NotificationItem = styled.div({
  padding: '18px 8px',
  borderBottom: `1px solid ${c.gray100}`,
  borderRadius: 6,
  cursor: 'pointer',
  transition: 'background 0.15s ease',
  '&:hover': { background: c.gray50 },
  '&:active': { background: c.gray100 },
});
export function NotificationsPage() {
  const [tab, setTab] = useState<string>('전체');
  const items = notificationItems.filter((x) => tab === '전체' || x.category === tab);
  return (
    <UserShell title="알림">
      <Content>
        <Stack gap={20}>
          <DesktopOnly>
            <Title>알림</Title>
          </DesktopOnly>
          <Row>
            {notificationTabs.map((x) => (
              <Chip key={x} selected={x === tab} aria-pressed={x === tab} onClick={() => setTab(x)}>
                {x}
              </Chip>
            ))}
          </Row>
          <NotificationList>
            {items.map((item) => (
              <NotificationItem key={item.id}>
                <Heading style={{ fontSize: 14 }}>{item.title}</Heading>
                <Muted>{item.body}</Muted>
              </NotificationItem>
            ))}
          </NotificationList>
          {items.length === 0 && <Muted>알림이 없어요.</Muted>}
        </Stack>
      </Content>
    </UserShell>
  );
}

export function LegalPageBody({ kind }: { kind: 'privacy' | 'terms' | 'youth-protection' | 'advertising-policy' }) {
  const paragraphs =
    kind === 'privacy'
      ? (legalCopy as { privacy: string[] }).privacy
      : kind === 'youth-protection'
        ? (legalCopy as { youthProtection: string[] }).youthProtection
        : kind === 'advertising-policy'
          ? (legalCopy as { advertisingPolicy: string[] }).advertisingPolicy
          : (legalCopy as { terms: string[] }).terms;
  // Data shape: [title, intro, heading, body?, heading, body?, ...] — a heading
  // (조/장) isn't always followed by a body: chapter dividers like "제1장 총칙"
  // sit directly before the next heading with no body of their own.
  const [title, intro, ...articles] = paragraphs;
  const isHeading = (s: string) => /^제\s*\d+\s*(장|조)/.test(s);
  const isChapter = (s: string) => /^제\s*\d+\s*장/.test(s);
  const sections: { heading: string; body: string; isChapter: boolean }[] = [];
  for (let i = 0; i < articles.length;) {
    const next = articles[i + 1];
    const hasBody = next !== undefined && !isHeading(next);
    sections.push({
      heading: articles[i],
      body: hasBody ? next : '',
      isChapter: isChapter(articles[i]),
    });
    i += hasBody ? 2 : 1;
  }
  return (
    <Content>
      <Stack gap={24}>
        <Title style={{ fontSize: 32, fontWeight: 700, lineHeight: 'normal', color: c.gray900 }}>
          {title}
        </Title>
        <p style={{ ...textStyle.body, color: c.gray700, whiteSpace: 'pre-wrap' }}>{intro}</p>
        {sections.map((s, i) => (
          <section key={i}>
            <Heading
              style={{
                ...textStyle.h1_2,
                color: c.gray900,
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: s.isChapter ? 0 : 12,
              }}
            >
              {!s.isChapter && (
                <Icon src="/assets/icons/BulletIcon.png" width={8} height={23} alt="" />
              )}
              {s.heading}
            </Heading>
            {s.body && (
              <p style={{ ...textStyle.body, color: c.gray900, whiteSpace: 'pre-line' }}>
                {s.body}
              </p>
            )}
          </section>
        ))}
      </Stack>
    </Content>
  );
}

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' | 'youth-protection' | 'advertising-policy' }) {
  return (
    <UserShell title={kind === 'privacy' ? '개인정보처리방침' : kind === 'youth-protection' ? '청소년 보호 정책' : kind === 'advertising-policy' ? '광고 운영 정책' : '이용약관'}>
      <LegalPageBody kind={kind} />
    </UserShell>
  );
}
