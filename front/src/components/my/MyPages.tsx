'use client';
import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  notificationTabs,
  skillCatalog,
} from '@/data/user-design';
import { useUserStore } from '@/stores/useUserStore';
import { useToast } from '@/components/common/Toast';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { ApiError, generated } from '@semochal/api-client';
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

const CERTIFICATE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;
type UploadContentType = Parameters<typeof generated.requestPresignedUpload>[0]['contentType'];

function CertificateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [badge, setBadge] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const requestUpload = generated.useRequestPresignedUpload();
  const finalizeUpload = generated.useFinalizeUpload();
  const createCertificate = generated.useCreateCertificate();
  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (!CERTIFICATE_CONTENT_TYPES.includes(picked.type)) {
      toast.error('지원하지 않는 파일이에요', 'JPG, PNG, WEBP, PDF만 올릴 수 있어요');
      return;
    }
    if (picked.size > CERTIFICATE_MAX_BYTES) {
      toast.error('파일이 너무 커요', '10MB 이하 파일만 올릴 수 있어요');
      return;
    }
    setFile(picked);
  };
  const reset = () => {
    setBadge(null);
    setFile(null);
  };
  // 증명 문서는 개인정보라 private 버킷에만 올린다(presigned PUT 5분 → finalize 검증 → 인증 요청).
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!badge || !file || submitting) return;
    setSubmitting(true);
    try {
      const presigned = await requestUpload.mutateAsync({
        data: {
          bucket: 'private',
          contentType: file.type as UploadContentType,
          fileName: file.name.replace(/[/\\]/g, '_'),
          sizeBytes: file.size,
        },
      });
      const { uploadUrl, fileId } = presigned.data;
      if (!uploadUrl || !fileId) throw new Error('presign response is missing fields');
      // presigned URL은 우리 API가 아니라 S3로 직접 올리는 주소라 api-client를 거치지 않는다.
      const uploaded = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploaded.ok) throw new Error('upload failed');
      await finalizeUpload.mutateAsync({ id: fileId });
      await createCertificate.mutateAsync({
        data: { award: badge, category: badge === '수상경력' ? 'award' : 'participation', fileId },
      });
      await queryClient.invalidateQueries({
        queryKey: generated.getListMyCertificatesQueryKey(),
      });
      reset();
      onClose();
      toast.success('자격증 인증 요청을 보냈어요', '검토가 끝나면 뱃지가 표시돼요');
    } catch (error) {
      // API 단계 실패는 전역 MutationCache 토스트가 띄운다. S3 업로드 실패만 여기서 알린다.
      if (!(error instanceof ApiError)) {
        toast.error('인증 요청에 실패했어요', '잠시 후 다시 시도해주세요');
      }
    } finally {
      setSubmitting(false);
    }
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
            {file?.name ?? '증명 파일 첨부 (JPG, PNG, WEBP, PDF · 10MB 이하)'}
            <HiddenInput
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={pickFile}
              required
            />
          </UploadBox>
          <Row style={{ justifyContent: 'flex-end', marginTop: 4 }}>
            <Button type="button" small tone="plain" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" small disabled={!badge || !file || submitting}>
              {submitting ? '요청 중…' : '인증 요청'}
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
  onAdd: (skills: string[]) => Promise<unknown>;
}) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
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
          disabled={picked.length === 0 || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onAdd(picked);
              toast.success(`기술 ${picked.length}개를 추가했어요`);
              close();
            } catch {
              // 실패 토스트는 전역 MutationCache가 띄운다. 모달은 열어 둬 다시 시도할 수 있게 한다.
            } finally {
              setSaving(false);
            }
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
  const queryClient = useQueryClient();
  const me = generated.useGetMyAuthInfo({ query: { retry: false } });
  const mySkills = (me.data?.status === 200 ? me.data.data.stacks : undefined) ?? [];
  const certificatesQuery = generated.useListMyCertificates();
  // 반려된 요청은 뱃지로 보이지 않고, 검토 중인 요청은 상태를 함께 표시한다.
  const certificates = (certificatesQuery.data?.data ?? [])
    .filter((x) => x.status !== 'rejected')
    .map((x) => (x.status === 'verified' ? (x.title ?? '') : `${x.title ?? ''} · 검토 중`));
  const updateProfile = generated.useUpdateMyProfile({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: generated.getGetMyAuthInfoQueryKey() });
      },
    },
  });
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
            <AddButton
              aria-label="기술 스택 추가하기"
              // 서버 기술 스택을 받기 전에 열면 저장 시 기존 값을 덮어쓸 수 있어 막는다.
              disabled={me.data?.status !== 200}
              onClick={() => setSkillOpen(true)}
            >
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
      <CertificateModal open={certOpen} onClose={() => setCertOpen(false)} />
      <SkillAddModal
        open={skillOpen}
        onClose={() => setSkillOpen(false)}
        existing={mySkills}
        onAdd={(skills) =>
          updateProfile.mutateAsync({
            data: { stacks: [...mySkills, ...skills.filter((s) => !mySkills.includes(s))] },
          })
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
const notificationSettingKeys = notificationSettings.flatMap((g) => g.rows.map(([key]) => key));
export function NotificationSettingsPage() {
  const queryClient = useQueryClient();
  const me = generated.useGetMyAuthInfo({ query: { retry: false } });
  const saved = me.data?.status === 200 ? me.data.data.notificationSettings : undefined;
  // 저장된 적 없는 키는 기본 on. 서버(users.notification_settings)가 유일한 기준값이다.
  const values: Record<string, boolean> = Object.fromEntries(
    notificationSettingKeys.map((key) => [key, saved?.[key] ?? true]),
  );
  // TODO: 알림 생성 시(NotificationsService.create) 이 설정을 확인해 끈 유형은 저장하지 않도록 서버에서 강제해야 한다.
  // https://orm.drizzle.team/docs/select
  const save = generated.useSaveNotificationSettings({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: generated.getGetMyAuthInfoQueryKey() }),
    },
  });
  const toggle = (key: string) => {
    // 서버 값을 받기 전이나 저장 중에는 이전 값 기준으로 덮어쓰지 않게 막는다.
    if (me.data?.status !== 200 || save.isPending) return;
    save.mutate({
      data: Object.fromEntries(
        notificationSettingKeys.map((k) => [k, { enabled: k === key ? !values[k] : values[k] }]),
      ),
    });
  };
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

  // 이번에 드롭다운으로 바꾼 지원자만 전송한다(이미 결정된 지원자에게 알림을 다시 보내지 않는다).
  const changedMembers = (team: (typeof teams)[number]) =>
    (team.members ?? []).filter((member) => {
      const override = member.id ? overrides[member.id] : undefined;
      return (
        override !== undefined &&
        override !== '미정' &&
        override !== resultFromStatus(member.status)
      );
    });
  const closeSendModal = () => {
    // 다른 팀 모달로 링크가 넘어가지 않게 닫을 때마다 초기화한다.
    setSendTargetId(null);
    setLink('');
  };
  const refreshTeams = () => {
    void queryClient.invalidateQueries({ queryKey: generated.getListManagedTeamsQueryKey() });
    void queryClient.invalidateQueries({
      queryKey: generated.getListMyTeamApplicationsQueryKey(),
    });
  };

  const send = async (team: (typeof teams)[number]) => {
    const decided = changedMembers(team);
    if (decided.length === 0) {
      toast.error('전송할 결과가 없어요', '지원자의 결과를 먼저 선택해주세요');
      return;
    }
    // TODO: 여러 지원자 결과를 한 트랜잭션으로 저장하는 일괄 API가 없어 지원자별로 보낸다.
    // 부분 실패 시 성공한 건은 반영된 상태로 두고 실패한 지원자만 다시 보낼 수 있게 한다.
    // https://orm.drizzle.team/docs/transactions
    const results = await Promise.allSettled(
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
    const succeededIds = decided
      .filter((_, i) => results[i]?.status === 'fulfilled')
      .map((member) => member.id);
    setOverrides((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([id]) => !succeededIds.includes(id))),
    );
    refreshTeams();
    const failed = results.length - succeededIds.length;
    if (failed > 0) {
      toast.error(
        `${failed}명에게 결과를 전송하지 못했어요`,
        succeededIds.length > 0
          ? `${succeededIds.length}명은 전송됐어요. 실패한 지원자만 다시 시도해주세요`
          : '다시 시도해주세요',
      );
      return;
    }
    closeSendModal();
    toast.success('결과를 전송했어요', '지원자에게 알림으로 알려드릴게요');
  };
  const sendNeedsLink =
    sendTarget !== undefined &&
    changedMembers(sendTarget).some((member) => resultOf(member.id, member.status) === '합격');
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
      <Modal open={sendTarget !== undefined} onClose={closeSendModal} title="결과 전송하기">
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
            required={sendNeedsLink}
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <Row style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <Button type="button" small tone="plain" onClick={closeSendModal}>
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
  '&[data-unread] h2': { fontWeight: 700 },
  '&:not([data-unread])': { opacity: 0.7 },
});
// 서버 알림 type → 화면 탭. 매핑되지 않은 유형(verification.result 등)은 '전체'에서만 보인다.
const notificationCategory: Record<string, (typeof notificationTabs)[number]> = {
  team_matching: '팀매칭',
  deadline: '마감',
  posting: '공고',
};
function describeNotification(type: string, payload: Record<string, unknown>) {
  if (type === 'team_matching') {
    if (payload.status === 'accepted') return '팀 지원이 수락되었어요';
    if (payload.status === 'rejected') return '팀 지원 결과가 도착했어요';
    return typeof payload.role === 'string'
      ? `내 모집글에 새 ${payload.role} 지원자가 있어요`
      : '내 모집글에 새 지원자가 있어요';
  }
  if (type === 'verification.result') return '기업 인증 결과가 도착했어요';
  return '새 알림이 있어요';
}
function timeAgo(iso: string | undefined, now: number) {
  if (!iso) return '';
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  return `${Math.floor(minutes / (60 * 24))}일 전`;
}
export function NotificationsPage() {
  const [tab, setTab] = useState<string>('전체');
  // 상대 시간 기준 시각은 마운트 시 한 번만 잡는다(렌더 중 Date.now() 호출 금지).
  const [now] = useState(() => Date.now());
  const queryClient = useQueryClient();
  const router = useRouter();
  const notificationsQuery = generated.useListMyNotifications();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: generated.getListMyNotificationsQueryKey() });
  const markRead = generated.useMarkNotificationRead({ mutation: { onSuccess: invalidate } });
  const markAllRead = generated.useMarkAllNotificationsRead({
    mutation: { onSuccess: invalidate },
  });
  const all = notificationsQuery.data?.data ?? [];
  const items = all.filter((x) => tab === '전체' || notificationCategory[x.type ?? ''] === tab);
  const hasUnread = all.some((x) => !x.readAt);
  const openItem = (id?: string, readAt?: string | null, teamId?: string) => {
    if (id && !readAt) markRead.mutate({ id });
    if (teamId) router.push(`/teams/${teamId}`);
  };
  return (
    <UserShell title="알림">
      <Content>
        <Stack gap={20}>
          <DesktopOnly>
            <Title>알림</Title>
          </DesktopOnly>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row>
              {notificationTabs.map((x) => (
                <Chip
                  key={x}
                  selected={x === tab}
                  aria-pressed={x === tab}
                  onClick={() => setTab(x)}
                >
                  {x}
                </Chip>
              ))}
            </Row>
            <Button
              small
              tone="plain"
              disabled={!hasUnread || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              모두 읽음
            </Button>
          </Row>
          <NotificationList>
            {items.map((item) => {
              const payload = (item.payload ?? {}) as Record<string, unknown>;
              const teamId = typeof payload.teamId === 'string' ? payload.teamId : undefined;
              return (
                <NotificationItem
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  data-unread={!item.readAt || undefined}
                  onClick={() => openItem(item.id, item.readAt, teamId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openItem(item.id, item.readAt, teamId);
                  }}
                >
                  <Heading style={{ fontSize: 14 }}>
                    {describeNotification(item.type ?? '', payload)}
                  </Heading>
                  <Muted>{timeAgo(item.createdAt, now)}</Muted>
                </NotificationItem>
              );
            })}
          </NotificationList>
          {notificationsQuery.isPending && <Muted>알림을 불러오는 중이에요.</Muted>}
          {notificationsQuery.isError && <Muted>알림을 불러오지 못했어요.</Muted>}
          {notificationsQuery.isSuccess && items.length === 0 && <Muted>알림이 없어요.</Muted>}
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
