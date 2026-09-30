'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { BizContent, useBizHref } from '@/components/biz/BizShell';
import { useToast } from '@/components/common/Toast';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { adApi, adError } from '@/lib/ad-api';
import { toDateKey } from '@/lib/date';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { challengeTargets, organizerTypes } from '@/data/user-design';
import { AD_IMAGE_PRESETS, compressToWebP } from '@/lib/image-compression';

const ICON = '/assets/icons';

const chipRows: string[][] = [
  ['# 비즈니스/스타트업', '# 경제/금융/투자', '# 과학/IT/AI', '# 마케팅/PR'],
  [
    '# 사회/역사',
    '# 인문/심리',
    '# 문화/예술/디자인',
    '# 게임',
    '# 여행/레저',
    '# 세미나',
    '# 인턴십',
  ],
  ['# 운동/건강/웰빙', '# 자연/환경', '# 가족/육아', '#동식물/반려동물', '#음식/음료'],
  ['#영화/드라마/미디어', '#패션/뷰티', '# 자기계발/학습/독서', '# DIY/공예', '# 종교', '# 기타'],
];
const categories = ['IT/SW', '디자인', '창업/취업', '기획', '광고/마케팅', '대회', '해외'];

export function BizPostingFormPage() {
  const router = useRouter();
  const hrefOf = useBizHref();
  const [businessId, setBusinessId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const createChallenge = generated.useCreateChallenge();

  useEffect(() => {
    let active = true;
    adApi.businesses
      .me()
      .then((business) => active && setBusinessId(business.id))
      .catch((cause) => active && setLoadError(adError(cause)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <PostingForm
      initial={EMPTY_POSTING}
      submitLabel="게시하기"
      submittingLabel="게시 중…"
      disabled={loading || !businessId}
      initialError={loadError}
      onSubmit={async (values) => {
        // 생성 스펙은 null을 받지 않으므로(nullable이 아닌 선택 필드), 수정용 폼 값의 null은 생략으로 바꿔 본다.
        const response = await createChallenge.mutateAsync({
          data: {
            businessId,
            ...values,
            category: values.category ?? undefined,
            targets: values.targets ?? undefined,
            organizerType: values.organizerType ?? undefined,
            prizeAmount: values.prizeAmount ?? undefined,
            posterFileId: values.posterFileId ?? undefined,
          },
        });
        router.push(hrefOf(`/postings/${response.data.id}`));
      }}
      showRecruitMethod
    />
  );
}

export function BizPostingEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hrefOf = useBizHref();
  const toast = useToast();
  const queryClient = useQueryClient();
  const challengeQuery = generated.useGetChallenge(id, { query: { enabled: Boolean(id) } });
  const updateChallenge = generated.useUpdateChallenge();
  const challenge = challengeQuery.data?.status === 200 ? challengeQuery.data.data : undefined;

  if (challengeQuery.isPending)
    return (
      <BizContent>
        <Message>공고 정보를 불러오는 중입니다.</Message>
      </BizContent>
    );
  if (!challenge)
    return (
      <BizContent>
        <Message>
          공고를 불러오지 못했습니다.{' '}
          <button type="button" onClick={() => void challengeQuery.refetch()}>
            다시 시도
          </button>
        </Message>
      </BizContent>
    );

  return (
    <PostingForm
      initial={{
        title: challenge.title ?? '',
        description: challenge.description ?? '',
        price: challenge.price ?? 0,
        capacity: String(challenge.capacity ?? 1),
        startDate: toDateInput(challenge.startDate),
        endDate: toDateInput(challenge.endDate),
        category: challenge.category ?? '',
        posterUrl: challenge.posterUrl ?? null,
        targets: challenge.targets ?? [],
        organizerType: challenge.organizerType ?? null,
        prizeAmount:
          challenge.prizeAmount === undefined || challenge.prizeAmount === null
            ? ''
            : String(challenge.prizeAmount),
        recruitMethod: challenge.recruitMethod,
        recruitUrl: challenge.recruitUrl ?? '',
      }}
      submitLabel="수정 저장"
      submittingLabel="저장 중…"
      onSubmit={async (values) => {
        await updateChallenge.mutateAsync({ id, data: values });
        await queryClient.invalidateQueries({ queryKey: generated.getGetChallengeQueryKey(id) });
        toast.success('공고를 수정했습니다');
        router.push(hrefOf(`/postings/${id}`));
      }}
    />
  );
}

type PostingInput = {
  title: string;
  description: string;
  /** Figma 폼에는 참가비 입력이 없어 신규는 0, 수정은 기존 값을 그대로 보존한다. */
  price: number;
  capacity: string;
  startDate: string;
  endDate: string;
  category: string;
  posterUrl?: string | null;
  targets: NonNullable<generated.UpdateChallengeMutationBody['targets']>;
  organizerType: (typeof organizerTypes)[number] | null;
  prizeAmount: string;
  recruitMethod?: 'seMOchall' | 'external';
  recruitUrl?: string;
};
// 생성/수정 API의 본문 타입과 1:1로 맞춘다 — `as` 캐스트 없이 mutate에 그대로 넘긬다.
// 폼에서 항상 값이 있는 핵심 필드는 필수로 좁혀, 수기 create 클라이언트의 Pick<Challenge, ...> 계약에도 맞는다.
type PostingValues = generated.UpdateChallengeMutationBody & {
  title: string;
  description: string;
  price: number;
  capacity: number;
  startDate: string;
  endDate: string;
  category: string | null;
  recruitMethod?: 'seMOchall' | 'external';
  recruitUrl?: string;
};

const EMPTY_POSTING: PostingInput = {
  title: '',
  description: '',
  price: 0,
  capacity: '1',
  startDate: '',
  endDate: '',
  category: '',
  targets: [],
  organizerType: null,
  prizeAmount: '',
};

const categoryDropdownOptions: DropdownOption[] = categories.map((x) => ({ value: x, label: x }));
const organizerTypeOptions: DropdownOption[] = organizerTypes.map((x) => ({ value: x, label: x }));

// TODO: 툴팁 중 정렬/색상/텍스트 스타일/링크/이미지/인용/코드/구분선은 서식 저장 API(현재 description은 평문)가
// 생긴 뒤 연결한다. https://developer.mozilla.org/docs/Web/API/Document/execCommand
const EDITOR_COMMANDS = {
  undo: 'undo',
  redo: 'redo',
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strikeThrough',
  clear: 'removeFormat',
  bullet: 'insertUnorderedList',
  number: 'insertOrderedList',
} as const;
type EditorCommand = keyof typeof EDITOR_COMMANDS;

function ToolBtn({
  label,
  icon,
  command,
  onRun,
}: {
  label: string;
  icon: string;
  command?: EditorCommand;
  onRun: (command: EditorCommand) => void;
}) {
  return (
    <ToolButton
      type="button"
      aria-label={label}
      disabled={!command}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => command && onRun(command)}
    >
      <ToolIcon src={`${ICON}/${icon}`} alt="" />
    </ToolButton>
  );
}

function PostingForm({
  initial,
  submitLabel,
  submittingLabel,
  disabled = false,
  initialError = '',
  showRecruitMethod = false,
  onSubmit,
}: {
  initial: PostingInput;
  submitLabel: string;
  submittingLabel: string;
  disabled?: boolean;
  initialError?: string;
  showRecruitMethod?: boolean;
  onSubmit: (values: PostingValues) => Promise<void>;
}) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(initial.title);
  const [capacity, setCapacity] = useState(initial.capacity);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [category, setCategory] = useState(initial.category);
  const [targets, setTargets] = useState(initial.targets);
  const [organizerType, setOrganizerType] = useState(initial.organizerType);
  const [prizeAmount, setPrizeAmount] = useState(initial.prizeAmount);
  const [poster, setPoster] = useState<{ fileId: string; previewUrl: string } | null>(null);
  const existingPosterUrl = initial.posterUrl ?? null;
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const posterObjectUrl = useRef<string | null>(null);
  const [recruit, setRecruit] = useState<'semo' | 'external'>(
    initial.recruitMethod === 'external' ? 'external' : 'semo',
  );
  const [recruitUrl, setRecruitUrl] = useState(initial.recruitUrl ?? '');
  const [topics, setTopics] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const shownError = error || initialError;
  // 저장된 카테고리가 선택지에 없으면(과거 값 등) 사라지지 않도록 옵션에 포함한다.
  const dropdownOptions =
    initial.category && !categories.includes(initial.category)
      ? [{ value: initial.category, label: initial.category }, ...categoryDropdownOptions]
      : categoryDropdownOptions;

  useEffect(() => {
    if (editorRef.current) editorRef.current.innerText = initial.description;
  }, [initial.description]);
  useEffect(
    () => () => {
      if (posterObjectUrl.current) URL.revokeObjectURL(posterObjectUrl.current);
    },
    [],
  );

  const toggleTopic = (topic: string) =>
    setTopics((s) => (s.includes(topic) ? s.filter((x) => x !== topic) : [...s, topic]));
  const toggleTarget = (target: (typeof challengeTargets)[number]) =>
    setTargets((s) => (s.includes(target) ? s.filter((x) => x !== target) : [...s, target]));
  const runCommand = (command: EditorCommand) => {
    editorRef.current?.focus();
    document.execCommand(EDITOR_COMMANDS[command]);
  };

  const uploadPoster = async (file: File) => {
    if (uploadingPoster) return;
    setUploadingPoster(true);
    let image: Awaited<ReturnType<typeof compressToWebP>> | undefined;
    try {
      image = await compressToWebP(file, AD_IMAGE_PRESETS.hero);
      const presigned = await adApi.files.requestUpload({
        bucket: 'public',
        contentType: image.file.type,
        fileName: image.file.name,
        sizeBytes: image.file.size,
      });
      const response = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': image.file.type },
        body: image.file,
      });
      if (!response.ok) throw new globalThis.Error('이미지 업로드에 실패했습니다.');
      await adApi.files.finalizeUpload(presigned.fileId);
      if (posterObjectUrl.current) URL.revokeObjectURL(posterObjectUrl.current);
      posterObjectUrl.current = image.previewUrl;
      setPoster({ fileId: presigned.fileId, previewUrl: image.previewUrl });
    } catch {
      if (image) URL.revokeObjectURL(image.previewUrl);
      setError('포스터 업로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setUploadingPoster(false);
    }
  };

  async function submit() {
    setError('');
    const description = (editorRef.current?.innerText ?? '').trim();
    const parsedCapacity = Number(capacity);
    const parsedPrizeAmount = prizeAmount === '' ? null : Number(prizeAmount);
    if (!title.trim() || !description || !startDate || !endDate)
      return setError('제목, 상세정보, 접수 기간을 입력해 주세요.');
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1)
      return setError('모집 인원은 1명 이상으로 입력해 주세요.');
    if (
      parsedPrizeAmount !== null &&
      (!Number.isInteger(parsedPrizeAmount) || parsedPrizeAmount < 0)
    )
      return setError('총상금은 0 이상의 정수(만원)로 입력해 주세요.');
    if (endDate < startDate) return setError('종료일은 시작일 이후여야 합니다.');
    const trimmedRecruitUrl = recruitUrl.trim();
    if (recruit === 'external') {
      if (!trimmedRecruitUrl) return setError('외부 지원 링크 URL을 입력해 주세요.');
      if (!isHttpUrl(trimmedRecruitUrl))
        return setError('외부 지원 링크는 http(s)://로 시작하는 올바른 URL이어야 합니다.');
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description,
        price: initial.price,
        capacity: parsedCapacity,
        startDate: toLocalBoundary(startDate, false),
        endDate: toLocalBoundary(endDate, true),
        category: category || null,
        targets,
        organizerType: organizerType || null,
        prizeAmount: parsedPrizeAmount,
        ...(poster ? { posterFileId: poster.fileId } : {}),
        ...(showRecruitMethod
          ? { recruitMethod: recruit === 'semo' ? 'seMOchall' : 'external' }
          : {}),
        ...(recruit === 'external' ? { recruitUrl: trimmedRecruitUrl } : {}),
      });
    } catch (cause) {
      setError(adError(cause));
    } finally {
      setSubmitting(false);
    }
  }

  const radioIcon = (on: boolean) => `${ICON}/figma-radio-${on ? 'on' : 'off'}.svg`;
  return (
    <FormWrap>
      <Uploader>
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void uploadPoster(file);
          }}
        />
        {poster?.previewUrl || existingPosterUrl ? (
          <PosterPreview
            src={poster?.previewUrl ?? existingPosterUrl ?? ''}
            alt="포스터 미리보기"
          />
        ) : (
          <>
            <UploadMark src={`${ICON}/fileuploader.png`} alt="" />
            <UploadText>파일 찾기</UploadText>
          </>
        )}
        {uploadingPoster && <UploadText>포스터를 업로드하는 중입니다…</UploadText>}
      </Uploader>

      <Body>
        <TitleSection>
          <TitleInput
            placeholder="제목을 입력해주세요"
            aria-label="공고 제목"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Roles aria-label="접수 기간과 모집 인원">
            <RoleRow>
              <RoleIcon src={`${ICON}/figma-role-calendar.svg`} alt="" />
              <RoleInput
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="접수 시작일"
              />
              <RoleInput
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="접수 종료일"
              />
            </RoleRow>
            <RoleRow>
              <RoleIcon src={`${ICON}/figma-role-people.svg`} alt="" />
              <RoleInput
                type="number"
                min={1}
                step={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                aria-label="모집 인원"
              />
            </RoleRow>
          </Roles>
        </TitleSection>

        <Fields>
          <FieldBlock>
            <FieldLabel>설명문구를 적어주세요.</FieldLabel>
            {/* TODO: 설명문구·해시태그·문의연락처·공개 여부는 challenges 스키마/DTO에 컬럼이 생기면 저장한다. */}
            <LineInput aria-label="설명문구" />
          </FieldBlock>
          <FieldBlock>
            <FieldLabel>해시태그를 적어주세요.</FieldLabel>
            <LineInput aria-label="해시태그" />
          </FieldBlock>
          <FieldBlock>
            <FieldLabel>상세정보를 적어주세요.</FieldLabel>
            <EditorBox>
              <MenuBar role="toolbar" aria-label="텍스트 에디터">
                <ToolGroup>
                  <ToolBtn
                    onRun={runCommand}
                    label="되돌리기"
                    icon="figma-undo.svg"
                    command="undo"
                  />
                  <ToolBtn
                    onRun={runCommand}
                    label="다시 실행"
                    icon="figma-redo.svg"
                    command="redo"
                  />
                </ToolGroup>
                <ToolGroup>
                  <DropdownTextButton type="button" disabled>
                    Normal text
                    <ChevronIcon src={`${ICON}/figma-chevron-down.svg`} alt="" />
                  </DropdownTextButton>
                </ToolGroup>
                <ToolGroup>
                  <DropdownIconButton type="button" aria-label="텍스트 정렬" disabled>
                    <ToolIcon src={`${ICON}/figma-align-left.svg`} alt="" />
                    <ChevronIcon src={`${ICON}/figma-chevron-down.svg`} alt="" />
                  </DropdownIconButton>
                </ToolGroup>
                <ToolGroup>
                  <DropdownIconButton type="button" aria-label="색상" disabled>
                    <ToolIcon src={`${ICON}/figma-color-picker.svg`} alt="" />
                    <ChevronIcon src={`${ICON}/figma-chevron-down.svg`} alt="" />
                  </DropdownIconButton>
                </ToolGroup>
                <ToolGroup>
                  <ToolBtn onRun={runCommand} label="굵게" icon="figma-bold.svg" command="bold" />
                  <ToolBtn
                    onRun={runCommand}
                    label="기울임"
                    icon="figma-italic.svg"
                    command="italic"
                  />
                  <ToolBtn
                    onRun={runCommand}
                    label="밑줄"
                    icon="figma-underline.svg"
                    command="underline"
                  />
                  <ToolBtn
                    onRun={runCommand}
                    label="취소선"
                    icon="figma-strike.svg"
                    command="strike"
                  />
                  <ToolBtn onRun={runCommand} label="인라인 코드" icon="figma-code.svg" />
                  <ToolBtn
                    onRun={runCommand}
                    label="서식 지우기"
                    icon="figma-clear-format.svg"
                    command="clear"
                  />
                </ToolGroup>
                <ToolGroup>
                  <ToolBtn
                    onRun={runCommand}
                    label="글머리 기호 목록"
                    icon="figma-bullet-list.svg"
                    command="bullet"
                  />
                  <ToolBtn
                    onRun={runCommand}
                    label="번호 매기기 목록"
                    icon="figma-number-list.svg"
                    command="number"
                  />
                </ToolGroup>
                <ToolGroup>
                  <ToolBtn onRun={runCommand} label="링크" icon="figma-link.svg" />
                  <ToolBtn onRun={runCommand} label="이미지" icon="figma-image.svg" />
                  <ToolBtn onRun={runCommand} label="인용" icon="figma-quote.svg" />
                  <ToolBtn onRun={runCommand} label="구분선" icon="figma-rule.svg" />
                </ToolGroup>
              </MenuBar>
              <ContentsArea
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label="상세정보 본문"
                data-placeholder="내용을 입력해주세요"
              />
            </EditorBox>
          </FieldBlock>

          <TwoCol>
            <CategoryBlock>
              <FieldLabel>카테고리</FieldLabel>
              <Dropdown
                options={dropdownOptions}
                value={category || undefined}
                placeholder="종류를 선택하세요"
                size="L"
                aria-label="카테고리"
                onChange={setCategory}
              />
            </CategoryBlock>
            <TopicBlock>
              <FieldLabel>주제</FieldLabel>
              <Chips role="group" aria-label="주제">
                {chipRows.map((row, i) => (
                  <ChipRow key={i}>
                    {row.map((topic) => (
                      <Chip
                        key={topic}
                        type="button"
                        selected={topics.includes(topic)}
                        aria-pressed={topics.includes(topic)}
                        onClick={() => toggleTopic(topic)}
                      >
                        {topic}
                      </Chip>
                    ))}
                  </ChipRow>
                ))}
              </Chips>
            </TopicBlock>
          </TwoCol>

          <FieldBlock>
            <FieldLabel>대상</FieldLabel>
            <Chips role="group" aria-label="대상">
              <ChipRow>
                {challengeTargets.map((target) => (
                  <Chip
                    key={target}
                    type="button"
                    selected={targets.includes(target)}
                    aria-pressed={targets.includes(target)}
                    onClick={() => toggleTarget(target)}
                  >
                    {target}
                  </Chip>
                ))}
              </ChipRow>
            </Chips>
          </FieldBlock>

          <TwoCol>
            <CategoryBlock>
              <FieldLabel>주최기관</FieldLabel>
              <Dropdown
                options={organizerTypeOptions}
                value={organizerType || undefined}
                placeholder="선택 안 함"
                size="L"
                aria-label="주최기관"
                onChange={(value) => setOrganizerType(value as (typeof organizerTypes)[number])}
              />
            </CategoryBlock>
            <FieldBlock>
              <FieldLabel>총상금(만원)</FieldLabel>
              <LineInput
                type="number"
                min={0}
                step={1}
                value={prizeAmount}
                onChange={(e) => setPrizeAmount(e.target.value)}
                aria-label="총상금(만원)"
              />
            </FieldBlock>
          </TwoCol>

          {showRecruitMethod && (
            <FieldBlock wide>
              <FieldLabel>모집방법</FieldLabel>
              <RadioColumn>
                <RadioOption>
                  <RadioInput
                    type="radio"
                    name="recruit"
                    checked={recruit === 'semo'}
                    onChange={() => setRecruit('semo')}
                  />
                  <RadioIcon src={radioIcon(recruit === 'semo')} alt="" />
                  세모챌에서 만들기
                </RadioOption>
                <RoleRow>
                  <RadioOption>
                    <RadioInput
                      type="radio"
                      name="recruit"
                      checked={recruit === 'external'}
                      onChange={() => setRecruit('external')}
                    />
                    <RadioIcon src={radioIcon(recruit === 'external')} alt="" />
                    외부 링크 추가
                  </RadioOption>
                  {recruit === 'external' && (
                    <LinkInput
                      type="url"
                      aria-label="외부 링크"
                      value={recruitUrl}
                      onChange={(event) => setRecruitUrl(event.target.value)}
                      placeholder="https://example.com/apply"
                      required
                    />
                  )}
                </RoleRow>
              </RadioColumn>
            </FieldBlock>
          )}

          {!showRecruitMethod && recruit === 'external' && (
            <FieldBlock wide>
              <FieldLabel>외부 지원 링크 URL</FieldLabel>
              <LinkInput
                type="url"
                aria-label="외부 링크"
                value={recruitUrl}
                onChange={(event) => setRecruitUrl(event.target.value)}
                placeholder="https://example.com/apply"
                required
              />
            </FieldBlock>
          )}

          <FieldBlock>
            <FieldLabel>문의연락처</FieldLabel>
            <ContactInput aria-label="문의연락처" />
          </FieldBlock>

          <FieldBlock wide>
            <FieldLabel>공개</FieldLabel>
            <RadioColumn>
              <RadioOption>
                <RadioInput
                  type="radio"
                  name="visibility"
                  checked={visibility === 'public'}
                  onChange={() => setVisibility('public')}
                />
                <RadioIcon src={radioIcon(visibility === 'public')} alt="" />
                공개
              </RadioOption>
              <RadioOption>
                <RadioInput
                  type="radio"
                  name="visibility"
                  checked={visibility === 'private'}
                  onChange={() => setVisibility('private')}
                />
                <RadioIcon src={radioIcon(visibility === 'private')} alt="" />
                비공개
              </RadioOption>
            </RadioColumn>
          </FieldBlock>
        </Fields>
      </Body>

      {shownError && <Error role="alert">{shownError}</Error>}
      <Actions>
        <CancelButton type="button" onClick={() => router.back()}>
          취소하기
        </CancelButton>
        <PublishButton
          type="button"
          disabled={disabled || submitting || uploadingPoster}
          onClick={() => void submit()}
        >
          {submitting ? submittingLabel : submitLabel}
        </PublishButton>
      </Actions>
    </FormWrap>
  );
}

const Error = styled.p({ color: c.red, margin: 0, textAlign: 'center' });
const Message = styled.p({ color: c.gray700, margin: 0 });
const PosterPreview = styled.img({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: 14,
});

const FormWrap = styled.div({
  width: '100%',
  maxWidth: 1100,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});

const Body = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 60,
});

/* ---------- 파일 업로더 ---------- */
const Uploader = styled.label({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 4,
  height: 282,
  padding: 8,
  background: '#f8f8f8',
  border: `2px dashed ${c.lightBlue}`,
  borderRadius: 20,
  cursor: 'pointer',
});
const UploadMark = styled.img({ width: 58, height: 36, objectFit: 'contain' });
const UploadText = styled.span({ ...textStyle.mInfoText, color: c.gray500 });

/* ---------- 제목 + 모집 역할 ---------- */
const TitleSection = styled.div({ display: 'flex', flexDirection: 'column', gap: 16 });
const TitleInput = styled.input({
  border: 0,
  outline: 'none',
  width: '100%',
  fontSize: 40,
  fontWeight: 600,
  '::placeholder': { color: c.gray500 },
});
const Roles = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  width: 592,
  maxWidth: '100%',
});
const RoleRow = styled.div({ display: 'flex', alignItems: 'center', gap: 8 });
const RoleIcon = styled.img({ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 });
const RoleInput = styled.input({
  flex: 1,
  minWidth: 0,
  height: 32,
  border: `1px solid ${c.gray300}`,
  borderRadius: 8,
  padding: '0 14px',
  '&:focus': { outline: 'none', borderColor: c.primary },
});
const AddRoleButton = styled.button({
  width: 24,
  height: 24,
  padding: 0,
  border: 0,
  background: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

/* ---------- 입력 필드 ---------- */
const Fields = styled.div({ display: 'flex', flexDirection: 'column', gap: 20 });
const FieldBlock = styled.div<{ wide?: boolean }>(({ wide }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: wide ? 10 : 8,
}));
const FieldLabel = styled.span({
  fontSize: 18,
  fontWeight: 400,
  letterSpacing: '-0.01em',
  color: c.gray900,
});
const LineInput = styled.input({
  width: '100%',
  height: 40,
  border: `1px solid ${c.gray300}`,
  borderRadius: 8,
  padding: '0 14px',
  '&:focus': { outline: 'none', borderColor: c.primary },
});

/* ---------- 텍스트 에디터 ---------- */
const EditorBox = styled.div({
  border: '1px solid #e9ecef',
  borderRadius: 8,
  background: c.white,
  overflow: 'hidden',
});
const MenuBar = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: 8,
  flexWrap: 'wrap',
});
const ToolGroup = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  padding: 2,
  border: '1px solid #e9ecef',
  borderRadius: 4,
});
const ToolButton = styled.button({
  width: 28,
  height: 28,
  border: 0,
  borderRadius: 4,
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:hover': { background: c.gray100 },
});
const ToolIcon = styled.img({ width: 20, height: 20, objectFit: 'contain' });
const DropdownButton = styled.button({
  height: 28,
  border: 0,
  borderRadius: 4,
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  ...textStyle.bodySmall,
  color: c.gray900,
  '&:hover': { background: c.gray100 },
});
const DropdownTextButton = styled(DropdownButton)({ padding: '0 4px 0 8px' });
const DropdownIconButton = styled(DropdownButton)({ padding: '0 4px' });
const ChevronIcon = styled.img({ width: 16, height: 16, objectFit: 'contain' });
const ContentsArea = styled.div({
  padding: '12px 16px 16px',
  outline: 'none',
  minHeight: 320,
  cursor: 'text',
  '& h1': { fontSize: 24, fontWeight: 700, lineHeight: 1.25 },
  '& h2': { fontSize: 18, fontWeight: 700, lineHeight: 1.25, marginTop: 10 },
  '& h3': { fontSize: 16, fontWeight: 700, lineHeight: 1.25, marginTop: 10 },
  '& p': { fontSize: 15, lineHeight: 1.6, marginTop: 10 },
  '& img': { width: '100%', height: 507, objectFit: 'contain', marginTop: 12 },
  '&:empty::before': { content: 'attr(data-placeholder)', color: c.gray300 },
});

/* ---------- 카테고리 / 주제 ---------- */
const TwoCol = styled.div({
  display: 'flex',
  gap: 20,
  alignItems: 'flex-start',
});
const CategoryBlock = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  flex: '1 1 280px',
});
const TopicBlock = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  flex: '2 1 0',
  minWidth: 0,
});
const Chips = styled.div({ display: 'flex', flexDirection: 'column', gap: 10 });
const ChipRow = styled.div({ display: 'flex', flexWrap: 'wrap', gap: 8 });
const Chip = styled.button<{ selected?: boolean }>(({ selected }) => ({
  padding: '8px 10px',
  borderRadius: 20,
  border: selected ? '1px solid transparent' : `1px solid ${c.gray300}`,
  background: selected ? c.primary : c.white,
  color: selected ? c.white : c.gray700,
  fontSize: 12,
  fontWeight: selected ? 600 : 400,
  '&:hover': { borderColor: selected ? 'transparent' : c.primary },
}));

/* ---------- 라디오 ---------- */
const RadioColumn = styled.div({ display: 'flex', flexDirection: 'column', gap: 16 });
const RadioOption = styled.label({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  ...textStyle.bodySmall,
  color: c.gray900,
});
const RadioInput = styled.input({
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
});
const RadioIcon = styled.img({ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 });
const LinkInput = styled.input({
  width: 470,
  maxWidth: '100%',
  height: 36,
  border: `1px solid ${c.gray200}`,
  borderRadius: 8,
  padding: '0 14px',
  '&:focus': { outline: 'none', borderColor: c.primary },
});

/* ---------- 문의연락처 ---------- */
const ContactInput = styled.input({
  width: '100%',
  height: 40,
  border: `1px solid ${c.gray200}`,
  borderRadius: 8,
  padding: '0 14px',
  '&:focus': { outline: 'none', borderColor: c.primary },
});

/* ---------- 하단 버튼 ---------- */
const Actions = styled.div({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 8,
});
const CancelButton = styled.button({
  width: 183,
  height: 37,
  border: `1px solid ${c.gray200}`,
  borderRadius: 6,
  background: c.white,
  color: c.gray900,
  ...textStyle.overline,
  '&:hover': { background: c.gray50 },
});
const PublishButton = styled.button({
  width: 183,
  height: 37,
  border: 0,
  borderRadius: 6,
  background: c.primary,
  color: c.white,
  ...textStyle.subtitle,
  '&:hover': { background: '#005ee0' },
});

function toDateInput(value: string | undefined) {
  return value ? toDateKey(new Date(value)) : '';
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function toLocalBoundary(value: string, endOfDay: boolean) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  ).toISOString();
}
