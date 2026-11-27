'use client';
import { useMemo, useState, type FormEvent } from 'react';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Chip,
  Row,
  Stack,
  Wrap,
  Heading,
  Muted,
  Input,
  Icon,
} from '@/components/common/Primitives';
import { FileUploader } from '@/components/ui/FileUploader';
import { Modal } from '@/components/common/Feedback';
import { Badges, SkillStack, AddButton } from '@/components/profile/ProfileCards';
import { normalizeLinkUrl, isGithubUrl } from '@/components/profile/link-model';
import { skillCatalog } from '@/data/user-design';
import { useToast } from '@/components/common/Toast';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { ApiError, generated } from '@semochal/api-client';
import {
  certificateBadges,
  CERTIFICATE_CONTENT_TYPES,
  CERTIFICATE_MAX_BYTES,
  CERTIFICATE_MAX_FILES,
} from './Mypage';
import { EndRow } from './styles';

type UploadContentType = Parameters<typeof generated.requestPresignedUpload>[0]['contentType'];

function CertificateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [badge, setBadge] = useState<string | null>(null);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const requestUpload = generated.useRequestPresignedUpload();
  const finalizeUpload = generated.useFinalizeUpload();
  const createCertificate = generated.useCreateCertificate();
  const pickFiles = (picked: File[]) => {
    const valid: File[] = [];
    for (const file of picked) {
      if (!CERTIFICATE_CONTENT_TYPES.includes(file.type)) {
        toast.error('지원하지 않는 파일이에요', 'JPG, PNG, WEBP, PDF만 올릴 수 있어요');
      } else if (file.size === 0) {
        toast.error('빈 파일은 올릴 수 없어요', '내용이 있는 파일을 선택해주세요');
      } else if (file.size > CERTIFICATE_MAX_BYTES) {
        toast.error('파일이 너무 커요', '10MB 이하 파일만 올릴 수 있어요');
      } else {
        valid.push(file);
      }
    }
    const next = [...pickedFiles, ...valid];
    if (next.length > CERTIFICATE_MAX_FILES) {
      toast.error('파일이 너무 많아요', `최대 ${CERTIFICATE_MAX_FILES}개까지 올릴 수 있어요`);
    }
    setPickedFiles(next.slice(0, CERTIFICATE_MAX_FILES));
  };
  const reset = () => {
    setBadge(null);
    setPickedFiles([]);
  };
  // 업로드 중에는 닫지 않는다(닫힌 뒤 요청이 끝나 새로 연 폼을 닫아버리는 것을 막는다).
  const close = () => {
    if (submitting) return;
    reset();
    onClose();
  };
  // 증명 문서는 개인정보라 private 버킷에만 올린다(presigned PUT 5분 → finalize 검증 → 인증 요청).
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!badge || pickedFiles.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const fileIds: string[] = [];
      for (const file of pickedFiles) {
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
        fileIds.push(fileId);
      }
      await createCertificate.mutateAsync({
        data: { award: badge, category: badge === '수상경력' ? 'award' : 'participation', fileIds },
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
    <Modal open={open} onClose={close} title="자격증 인증">
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
          <FileUploader
            multiple
            aria-label="증명 파일 첨부"
            label={`증명 파일 첨부 (JPG, PNG, WEBP, PDF · 10MB 이하 · 최대 ${CERTIFICATE_MAX_FILES}개)`}
            accept="image/jpeg,image/png,image/webp,application/pdf"
            required={pickedFiles.length === 0}
            disabled={submitting || pickedFiles.length >= CERTIFICATE_MAX_FILES}
            onFiles={pickFiles}
          />
          {pickedFiles.length > 0 && (
            <Stack gap={4} aria-label="선택한 증명 파일">
              {pickedFiles.map((picked, index) => (
                <Row key={`${picked.name}-${index}`} gap={8}>
                  <Muted>{picked.name}</Muted>
                  <Button
                    type="button"
                    small
                    tone="plain"
                    disabled={submitting}
                    aria-label={`${picked.name} 삭제`}
                    onClick={() => setPickedFiles((list) => list.filter((_, i) => i !== index))}
                  >
                    삭제
                  </Button>
                </Row>
              ))}
            </Stack>
          )}
          <EndRow $mt={4}>
            <Button type="button" small tone="plain" onClick={close} disabled={submitting}>
              취소
            </Button>
            <Button type="submit" small disabled={!badge || pickedFiles.length === 0 || submitting}>
              {submitting ? '요청 중…' : '인증 요청'}
            </Button>
          </EndRow>
        </Stack>
      </form>
    </Modal>
  );
}

const BIO_MAX_LENGTH = 100;

// 더블클릭으로 여는 인라인 편집 — Enter 저장, Escape/blur 취소.
function BioInlineEdit({
  initial,
  saving,
  onSubmit,
  onCancel,
}: {
  initial: string;
  saving: boolean;
  onSubmit: (bio: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const cancel = () => {
    if (!saving) onCancel();
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!saving) onSubmit(value.trim());
  };
  return (
    <InlineEditForm onSubmit={submit}>
      <Stack gap={4}>
        <Input
          autoFocus
          aria-label="한 줄 소개"
          placeholder="나를 한 줄로 소개해보세요"
          maxLength={BIO_MAX_LENGTH}
          value={value}
          disabled={saving}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          }}
          onBlur={cancel}
        />
        <InlineEditCount>
          {value.length}/{BIO_MAX_LENGTH}
        </InlineEditCount>
      </Stack>
    </InlineEditForm>
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
      <EndRow $mt={4}>
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
      </EndRow>
    </Modal>
  );
}

const LINK_LABEL_MAX_LENGTH = 50;
const LINK_URL_MAX_LENGTH = 500;

type LinkDraft = { label: string; url: string; portfolioBadge?: 'pending' | 'approved' };

// 프로필 링크(externalLinks)를 행 단위로 바로 편집한다. 이름·주소가 모두 유효한 행만 저장한다.
function InlineLinks({
  initial,
  onSave,
}: {
  initial: LinkDraft[];
  onSave: (links: LinkDraft[]) => Promise<unknown>;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<LinkDraft[]>(initial);
  const [saving, setSaving] = useState(false);
  const toSaved = (list: LinkDraft[]) => {
    const out: LinkDraft[] = [];
    for (const row of list) {
      const label = row.label.trim();
      const url = normalizeLinkUrl(row.url);
      // 포트폴리오 뱃지 상태(신청 중/승인됨)는 비-GitHub 링크에만 싣는다. 승인 여부는 서버가 다시 검증한다.
      if (label && url)
        out.push({
          label,
          url,
          ...(row.portfolioBadge && !isGithubUrl(url) && { portfolioBadge: row.portfolioBadge }),
        });
    }
    return out;
  };
  const [saved, setSaved] = useState(() => JSON.stringify(toSaved(initial)));
  const persist = async (list: LinkDraft[], checkUrl: boolean) => {
    if (checkUrl) {
      const bad = list.find((r) => r.label.trim() && r.url.trim() && !normalizeLinkUrl(r.url));
      if (bad) {
        toast.error('링크 주소를 확인해주세요', 'http:// 또는 https:// 주소만 저장할 수 있어요');
        return;
      }
    }
    const links = toSaved(list);
    const next = JSON.stringify(links);
    if (next === saved || saving) return;
    setSaving(true);
    try {
      await onSave(links);
      setSaved(next);
    } catch {
      toast.error('저장에 실패했어요', '잠시 후 다시 시도해주세요');
    } finally {
      setSaving(false);
    }
  };
  const updateRow = (index: number, patch: Partial<LinkDraft>) =>
    setRows((r) => r.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    setRows(next);
    void persist(next, false);
  };
  return (
    <>
      <LinkList>
        {rows.map((row, index) => (
          <LinkRow key={index}>
            <LinkLabelInput
              aria-label={`링크 이름 ${index + 1}`}
              placeholder="이름"
              maxLength={LINK_LABEL_MAX_LENGTH}
              value={row.label}
              onChange={(e) => updateRow(index, { label: e.target.value })}
              onBlur={() => void persist(rows, true)}
            />
            <LinkUrlInput
              aria-label={`링크 주소 ${index + 1}`}
              placeholder="https://"
              maxLength={LINK_URL_MAX_LENGTH}
              value={row.url}
              onChange={(e) => updateRow(index, { url: e.target.value })}
              onBlur={() => void persist(rows, true)}
            />
            {!isGithubUrl(row.url) && (
              <BadgeRequest>
                <input
                  type="checkbox"
                  aria-label={`링크 ${index + 1} 포트폴리오 뱃지 신청`}
                  checked={Boolean(row.portfolioBadge)}
                  // 승인된 뱃지는 실수로 해제해 재승인이 필요해지지 않도록 체크박스로 끄지 못하게 한다.
                  disabled={row.portfolioBadge === 'approved'}
                  onChange={(e) => {
                    const next: LinkDraft[] = rows.map((r, i) =>
                      i === index
                        ? {
                            ...r,
                            portfolioBadge: e.target.checked ? ('pending' as const) : undefined,
                          }
                        : r,
                    );
                    setRows(next);
                    void persist(next, true);
                  }}
                />
                {row.portfolioBadge === 'approved' ? '뱃지 승인됨' : '뱃지 신청'}
              </BadgeRequest>
            )}
            <LinkDeleteButton
              type="button"
              aria-label={`링크 ${index + 1} 삭제`}
              disabled={saving}
              onClick={() => removeRow(index)}
            >
              <Icon name="imgS2Del" size={16} />
            </LinkDeleteButton>
          </LinkRow>
        ))}
      </LinkList>
      <LinkAddButton type="button" onClick={() => setRows((r) => [...r, { label: '', url: '' }])}>
        <Icon name="imgAddSlotIc" size={14} />
        링크 추가
      </LinkAddButton>
    </>
  );
}

// 쿼리 결과를 뱃지 라벨로 바꾼다. 반려된 요청은 보이지 않고, 검토 중인 요청은 상태를 함께 표시한다.
export function useCertificateLabels() {
  const certificatesQuery = generated.useListMyCertificates();
  return (certificatesQuery.data?.data ?? [])
    .filter((x) => x.status !== 'rejected')
    .map((x) => (x.status === 'verified' ? (x.title ?? '') : `${x.title ?? ''} · 검토 중`));
}

// 한 줄 소개·뱃지·기술 스택·링크 편집. 데스크톱은 MY에, 모바일은 /my/profile-edit에서 쓴다.
export function ProfileEditor() {
  const toast = useToast();
  const [certOpen, setCertOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  const [bioEditing, setBioEditing] = useState(false);
  const [bioSaving, setBioSaving] = useState(false);
  const queryClient = useQueryClient();
  const me = generated.useGetMyAuthInfo({ query: { retry: false } });
  const meInfo = me.data?.status === 200 ? me.data.data : undefined;
  const mySkills = meInfo?.stacks ?? [];
  const myLinks = meInfo?.externalLinks ?? [];
  const certificates = useCertificateLabels();
  const updateProfile = generated.useUpdateMyProfile({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: generated.getGetMyAuthInfoQueryKey() });
      },
    },
  });
  // 한 줄 소개는 더블클릭으로 해당 자리에서 바로 고친다. 서버 프로필을 받기 전에는 시작하지 않는다.
  const startBioEdit = () => {
    if (me.data?.status !== 200) return;
    setBioEditing(true);
  };
  const saveBio = async (bio: string) => {
    setBioSaving(true);
    try {
      await updateProfile.mutateAsync({ data: { bio } });
      toast.success('한 줄 소개를 저장했어요');
      setBioEditing(false);
    } catch {
      toast.error('저장에 실패했어요', '잠시 후 다시 시도해주세요');
    } finally {
      setBioSaving(false);
    }
  };
  return (
    <Stack gap={28}>
      <Stack gap={12}>
        <Heading>한 줄 소개</Heading>
        {bioEditing ? (
          <BioInlineEdit
            // 편집 시작 시 최신 소개로 입력값을 초기화한다.
            key={meInfo?.bio ?? ''}
            initial={meInfo?.bio ?? ''}
            saving={bioSaving}
            onSubmit={saveBio}
            onCancel={() => setBioEditing(false)}
          />
        ) : (
          <Row gap={8}>
            <BioText onDoubleClick={startBioEdit} title="더블클릭하여 수정">
              {meInfo?.bio ? meInfo.bio : '한 줄 소개를 남겨보세요.'}
            </BioText>
            <AddButton
              aria-label={meInfo?.bio ? '한 줄 소개 수정하기' : '한 줄 소개 추가하기'}
              // 서버 프로필을 받기 전에 열면 빈 값으로 덮어쓸 수 있어 막는다.
              disabled={me.data?.status !== 200}
              onClick={startBioEdit}
            >
              <Icon name="imgAddSlotIc" size={18} />
            </AddButton>
          </Row>
        )}
      </Stack>
      <div>
        <BadgeHeading>내 뱃지</BadgeHeading>
        <Badges
          extra={certificates}
          trailing={
            <AddButton aria-label="자격증 인증하기" onClick={() => setCertOpen(true)}>
              <Icon name="imgAddSlotIc" size={18} />
            </AddButton>
          }
        />
      </div>
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
            <Icon name="imgAddSlotIc" size={18} />
          </AddButton>
        }
      />
      <Stack gap={12}>
        <Heading>링크</Heading>
        {me.data?.status === 200 ? (
          <InlineLinks
            initial={myLinks.map((link) => ({
              label: link.label ?? '',
              url: link.url ?? '',
              portfolioBadge: link.portfolioBadge,
            }))}
            onSave={(externalLinks) => updateProfile.mutateAsync({ data: { externalLinks } })}
          />
        ) : (
          <Muted>불러오는 중이에요.</Muted>
        )}
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
    </Stack>
  );
}

// Styles are kept together at the bottom so page behavior and layout definitions remain separate.
const SkillGrid = styled(Wrap)({ maxHeight: 220, overflowY: 'auto', alignItems: 'flex-start' });
const BioText = styled(Muted)({ cursor: 'text', borderRadius: 4 });
const LinkList = styled.div({ display: 'flex', flexDirection: 'column', gap: 12 });
const LinkRow = styled.div({ display: 'flex', alignItems: 'center', gap: 12 });
const linkInput = {
  height: 40,
  padding: '0 14px',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  minWidth: 0,
  font: 'inherit',
  fontSize: 15,
  color: c.gray900,
  background: 'transparent',
  '&::placeholder': { color: c.gray200 },
  '&:focus': { outline: 'none', borderColor: c.gray500 },
} as const;
const LinkLabelInput = styled.input({ ...linkInput, width: 101, flexShrink: 0 });
const LinkUrlInput = styled.input({ ...linkInput, flex: 1 });
const BadgeRequest = styled.label({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  flexShrink: 0,
  fontSize: 13,
  color: c.gray500,
  cursor: 'pointer',
});
const LinkDeleteButton = styled.button({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  flexShrink: 0,
  border: 0,
  background: 'transparent',
  color: c.gray500,
  cursor: 'pointer',
  '&:hover': { color: c.gray900 },
  '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
});
const LinkAddButton = styled.button({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  height: 40,
  width: '100%',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  background: 'transparent',
  color: c.gray500,
  ...textStyle.caption,
  cursor: 'pointer',
  '&:hover': { background: c.gray50 },
  '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
});
const InlineEditForm = styled.form({ flex: 1 });
const InlineEditCount = styled(Muted)({ textAlign: 'right' });
const BadgeHeading = styled(Heading)({ marginBottom: 12 });
