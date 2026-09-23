'use client';
import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
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
import {
  Identity,
  Badges,
  SkillStack,
  History,
  AddButton,
} from '@/components/profile/ProfileCards';
import { ContestCard, ContestGrid } from '@/components/contests/ContestCard';
import {
  desktopContests,
  preferenceGroups,
  notificationSettings,
  participatingTeams,
  notificationItems,
  notificationTabs,
  stacks,
  skillCatalog,
} from '@/data/user-design';
import { useUserStore } from '@/stores/useUserStore';
import { useToast } from '@/components/common/Toast';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { generated } from '@semochal/api-client';
import { useBookmarks } from '@/features/bookmarks/useBookmarks';
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
        onAdd={(skills) =>
          setMySkills((prev) => [...prev, ...skills.filter((s) => !prev.includes(s))])
        }
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
  const [sort, setSort] = useState('마감임박');
  const [two, setTwo] = useState(false);
  const serverSort = sort === '인기' ? 'popular' : sort === '최신' ? 'latest' : 'deadline';
  const { bookmarks, isPending, isError } = useBookmarks(serverSort);
  // D-day 기준 시각은 마운트 시 한 번만 잡는다(렌더 중 Date.now() 호출 금지).
  const [now] = useState(() => Date.now());
  const data = bookmarks.map((challenge) => ({
    id: challenge.id ?? '',
    title: challenge.title ?? '제목 없음',
    category: challenge.category ?? '기타',
    days: challenge.endDate
      ? Math.max(0, Math.ceil((new Date(challenge.endDate).getTime() - now) / 86_400_000))
      : 0,
  }));
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
        {isPending && <Muted>북마크를 불러오는 중이에요.</Muted>}
        {isError && <Muted>북마크를 불러오지 못했어요.</Muted>}
        {!isPending && !isError && data.length === 0 && <Muted>북마크한 챌린지가 없어요.</Muted>}
      </Stack>
    </MyShell>
  );
}
export function InterestsPage() {
  const state = useUserStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  // 관심분야는 서버 값이 기준이다. 브라우저에 남은 기본값이나 다른 계정의 값으로 덮어쓰지
  // 않도록, 서버 값을 받은 뒤에만 편집/저장할 수 있게 한다. 역할/대상은 기존대로 로컬 상태.
  const interestsQuery = generated.useGetInterests();
  const [editedInterests, setEditedInterests] = useState<string[] | null>(null);
  const interests = editedInterests ?? interestsQuery.data?.data.categories ?? [];
  const interestsReady = interestsQuery.isSuccess;
  const saveInterests = generated.useSaveInterests();
  const isSelected = (key: (typeof preferenceGroups)[number]['key'], value: string) =>
    key === 'interests' ? interests.includes(value) : state[key].includes(value);
  const toggle = (key: (typeof preferenceGroups)[number]['key'], value: string) => {
    if (key !== 'interests') {
      state.togglePreference(key, value);
      return;
    }
    if (!interestsReady) return;
    setEditedInterests(
      interests.includes(value) ? interests.filter((x) => x !== value) : [...interests, value],
    );
  };
  const save = () => {
    if (!interestsReady) return;
    saveInterests.mutate(
      { data: { categories: interests } },
      {
        onSuccess: () => {
          toast.success('관심분야를 저장했어요');
          void queryClient.invalidateQueries({ queryKey: generated.getGetInterestsQueryKey() });
          void queryClient.invalidateQueries({
            queryKey: generated.getListRecommendedChallengesQueryKey(),
          });
        },
        onError: () => toast.error('관심분야를 저장하지 못했어요. 다시 시도해주세요.'),
      },
    );
  };
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
                  selected={isSelected(g.key, x)}
                  aria-pressed={isSelected(g.key, x)}
                  disabled={g.key === 'interests' && !interestsReady}
                  onClick={() => toggle(g.key, x)}
                >
                  {x}
                </Chip>
              ))}
            </Wrap>
          </Stack>
        ))}
        {interestsQuery.isError && <Muted>관심분야를 불러오지 못했어요. 새로고침해주세요.</Muted>}
        <Button
          style={{ width: 160 }}
          onClick={save}
          disabled={!interestsReady || saveInterests.isPending}
        >
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
// 지원현황 결과 태그 매핑 — 서버 status 값을 화면 라벨/색상으로 바꾼다.
// 챌린지 지원: accepted→예선 통과, rejected→불합격, 그 외(pending 등)→심사중.
function challengeResultTag(status?: string): { label: string; tone: 'green' | 'blue' | 'red' } {
  if (status === 'accepted') return { label: '예선 통과', tone: 'green' };
  if (status === 'rejected') return { label: '불합격', tone: 'red' };
  return { label: '심사중', tone: 'blue' };
}
// 팀 지원: accepted→확정, rejected→불합격, pending→검토중.
function teamResultTag(status?: string): { label: string; tone: 'green' | 'blue' | 'red' } {
  if (status === 'accepted') return { label: '확정', tone: 'blue' };
  if (status === 'rejected') return { label: '불합격', tone: 'red' };
  return { label: '검토중', tone: 'green' };
}
export function ApplicationsPage() {
  const challengeQuery = generated.useListMyApplications();
  const teamQuery = generated.useListMyTeamApplications();
  const challengeApps = challengeQuery.data?.status === 200 ? challengeQuery.data.data : [];
  const teamApps = teamQuery.data?.status === 200 ? teamQuery.data.data : [];
  return (
    <MyShell title="지원현황">
      <Stack gap={40}>
        <section>
          <Title style={{ marginBottom: 20 }}>챌린지 지원 현황</Title>
          {challengeQuery.isPending ? (
            <Muted>불러오는 중이에요.</Muted>
          ) : challengeQuery.isError ? (
            <Muted>지원 내역을 불러오지 못했어요. 새로고침해주세요.</Muted>
          ) : challengeApps.length === 0 ? (
            <Muted>아직 지원한 챌린지가 없어요.</Muted>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>챌린지</th>
                  <th>협회</th>
                  <th>결과</th>
                </tr>
              </thead>
              <tbody>
                {challengeApps.map((row) => {
                  const result = challengeResultTag(row.status);
                  return (
                    <tr key={row.id}>
                      <td>
                        <Link href="/contests/public-data">{row.challengeTitle ?? '챌린지'}</Link>
                      </td>
                      <td>{row.businessName ?? '-'}</td>
                      <td>
                        <Tag tone={result.tone}>{result.label}</Tag>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </section>
        <section>
          <Title style={{ marginBottom: 20 }}>팀 지원현황</Title>
          {teamQuery.isPending ? (
            <Muted>불러오는 중이에요.</Muted>
          ) : teamQuery.isError ? (
            <Muted>지원 내역을 불러오지 못했어요. 새로고침해주세요.</Muted>
          ) : teamApps.length === 0 ? (
            <Muted>아직 지원한 팀이 없어요.</Muted>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>챌린지</th>
                  <th>팀</th>
                  <th>결과</th>
                </tr>
              </thead>
              <tbody>
                {teamApps.map((row) => {
                  const result = teamResultTag(row.status);
                  return (
                    <tr key={row.id}>
                      <td>{row.challengeTitle ?? '챌린지'}</td>
                      <td>{row.teamTitle ?? '팀'}</td>
                      <td>
                        <Tag tone={result.tone}>{result.label}</Tag>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </section>
      </Stack>
    </MyShell>
  );
}
const applicantResultOptions = ['미정', '합격', '불합격'].map((x) => ({
  value: x,
  label: x,
}));
type ApplicantResult = '미정' | '합격' | '불합격';
const resultFromStatus = (status?: string): ApplicantResult =>
  status === 'accepted' ? '합격' : status === 'rejected' ? '불합격' : '미정';
export function TeamApplicantsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const managedQuery = generated.useListManagedTeams();
  const teams = managedQuery.data?.status === 200 ? managedQuery.data.data : [];
  // 서버에서 받은 status를 기본값으로 하되, 드롭다운에서 바꾼 선택은 로컬에서 덮어쓴다.
  const [overrides, setOverrides] = useState<Record<string, ApplicantResult>>({});
  const [sendTargetId, setSendTargetId] = useState<string | null>(null);
  const [link, setLink] = useState('');
  const updateMember = generated.useUpdateTeamMember();
  const sendTarget = teams.find((team) => team.id === sendTargetId);

  const resultOf = (memberId: string | undefined, status?: string): ApplicantResult =>
    (memberId ? overrides[memberId] : undefined) ?? resultFromStatus(status);

  const send = async (team: (typeof teams)[number]) => {
    const decided = (team.members ?? []).filter(
      (member) => resultOf(member.id, member.status) !== '미정',
    );
    try {
      await Promise.all(
        decided.map((member) => {
          const result = resultOf(member.id, member.status);
          return updateMember.mutateAsync({
            id: team.id ?? '',
            memberId: member.id ?? '',
            data: {
              status: result === '합격' ? 'accepted' : 'rejected',
              // 합격자에게만 채팅방 링크를 저장해 알림으로 함께 본다.
              ...(result === '합격' && link.trim() ? { chatLink: link.trim() } : {}),
            },
          });
        }),
      );
      setSendTargetId(null);
      setLink('');
      setOverrides({});
      toast.success('결과를 전송했어요', '지원자에게 알림으로 알려드릴게요');
      void queryClient.invalidateQueries({ queryKey: generated.getListManagedTeamsQueryKey() });
      void queryClient.invalidateQueries({
        queryKey: generated.getListMyTeamApplicationsQueryKey(),
      });
    } catch {
      toast.error('결과를 전송하지 못했어요', '다시 시도해주세요');
    }
  };
  return (
    <MyShell title="팀 지원현황">
      <Stack gap={40}>
        {managedQuery.isPending ? (
          <Muted>불러오는 중이에요.</Muted>
        ) : managedQuery.isError ? (
          <Muted>팀 지원 현황을 불러오지 못했어요. 새로고침해주세요.</Muted>
        ) : teams.length === 0 ? (
          <Muted>아직 리더로 있는 팀이 없어요.</Muted>
        ) : (
          teams.map((team) => (
            <section key={team.id}>
              <div>
                <Title>{team.title}</Title>
                <Muted style={{ marginTop: 8 }}>
                  {team.challengeTitle ?? '챌린지'} · {team.businessName ?? '-'}
                </Muted>
              </div>
              <Row style={{ justifyContent: 'space-between', marginTop: 32 }}>
                <Heading>팀 지원현황</Heading>
                <Button small onClick={() => setSendTargetId(team.id ?? null)}>
                  결과 전송하기
                </Button>
              </Row>
              {(team.members ?? []).length === 0 ? (
                <Muted style={{ marginTop: 16 }}>아직 지원자가 없어요.</Muted>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>지원 역할</th>
                      <th>결과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(team.members ?? []).map((member) => (
                      <tr key={member.id}>
                        <td>{member.name ?? '지원자'}</td>
                        <td>
                          {member.role ? <Tag tone="blue">{member.role}</Tag> : <Muted>-</Muted>}
                        </td>
                        <td style={{ width: 130 }}>
                          <Dropdown
                            aria-label={`${member.name ?? '지원자'} 결과`}
                            size="S"
                            value={resultOf(member.id, member.status)}
                            onChange={(x) =>
                              member.id &&
                              setOverrides((prev) => ({
                                ...prev,
                                [member.id as string]: x as ApplicantResult,
                              }))
                            }
                            options={applicantResultOptions}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>
          ))
        )}
      </Stack>
      <Modal
        open={sendTarget !== undefined}
        onClose={() => setSendTargetId(null)}
        title="결과 전송하기"
      >
        <Muted style={{ color: c.red }}>*이 활동은 되돌릴 수 없어요</Muted>
        <p style={{ fontSize: 13 }}>합격자들에게 전송할 채팅방 링크를 첨부해주세요.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (sendTarget) void send(sendTarget);
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
            <Button type="button" small tone="plain" onClick={() => setSendTargetId(null)}>
              취소
            </Button>
            <Button type="submit" small disabled={updateMember.isPending}>
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

export function LegalPageBody({
  kind,
}: {
  kind: 'privacy' | 'terms' | 'youth-protection' | 'advertising-policy';
}) {
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
                <Icon src="/assets/icons/bullet-icon.png" width={8} height={23} alt="" />
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

export function LegalPage({
  kind,
}: {
  kind: 'privacy' | 'terms' | 'youth-protection' | 'advertising-policy';
}) {
  return (
    <UserShell
      title={
        kind === 'privacy'
          ? '개인정보처리방침'
          : kind === 'youth-protection'
            ? '청소년 보호 정책'
            : kind === 'advertising-policy'
              ? '광고 운영 정책'
              : '이용약관'
      }
    >
      <LegalPageBody kind={kind} />
    </UserShell>
  );
}
