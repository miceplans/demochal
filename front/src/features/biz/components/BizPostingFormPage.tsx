'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { BizContent, useBizHref } from '@/components/biz/BizShell';
import { useToast } from '@/components/common/Toast';
import { DayPicker } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { FileUploader } from '@/components/ui/FileUploader';
import { adApi, adError } from '@/lib/ad-api';
import { toDateKey } from '@/lib/date';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { challengeTargets, organizerTypes } from '@/data/user-design';
import { AD_IMAGE_PRESETS, compressToWebP, formatBytes } from '@/lib/image-compression';
import { cropErrorMessage, readImage, type CropImage } from '@/lib/image-crop';
import { recommendPosterCropPosition, type Position } from '@/lib/poster-ocr';
import { ImageCropModal } from '@/components/ui/ImageCropModal';
import { isRichHtml, sanitizeRichHtml } from '@/lib/rich-text';
import { PostingPreviewModal, type PostingPreview } from './PostingPreviewModal';
import { richContentStyles } from '@/components/common/RichDescription';

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
  ['# 운동/건강/웰빙', '# 자연/환경', '# 가족/육아', '# 동식물/반려동물', '# 음식/음료'],
  ['# 영화/드라마/미디어', '# 패션/뷰티', '# 자기계발/학습/독서', '# DIY/공예', '# 종교', '# 기타'],
  ['서포터즈/대회활동', '공모전 아이디어', '행사/전시/이벤트', '해외/국제', '강연/강의'],
];
const categories = [
  'IT/SW',
  '디자인',
  '창업/취업',
  '기획',
  '광고/마케팅',
  '대회',
  '해외',
  '대외활동',
  '홍보',
  '강연/강의',
];

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
            eventStartDate: values.eventStartDate ?? undefined,
            eventEndDate: values.eventEndDate ?? undefined,
            supervisor: values.supervisor ?? undefined,
            sponsor: values.sponsor ?? undefined,
            supporter: values.supporter ?? undefined,
            targetOther: values.targetOther ?? undefined,
            targets: values.targets ?? undefined,
            organizerType: values.organizerType ?? undefined,
            prizeAmount: values.prizeAmount ?? undefined,
            posterFileId: values.posterFileId ?? undefined,
            thumbnailFileId: values.thumbnailFileId ?? undefined,
            summary: values.summary ?? undefined,
            hashtags: values.hashtags ?? undefined,
            topics: values.topics ?? undefined,
            inquiryContact: values.inquiryContact ?? undefined,
            visibility: values.visibility,
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
  const challengeQuery = generated.useGetMyChallenge(id, { query: { enabled: Boolean(id) } });
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
        startDate: toDateTimeInput(challenge.startDate),
        endDate: toDateTimeInput(challenge.endDate),
        eventStartDate: toDateInput(challenge.eventStartDate ?? undefined),
        eventEndDate: toDateInput(challenge.eventEndDate ?? undefined),
        host: challenge.host ?? '',
        supervisor: challenge.supervisor ?? '',
        sponsor: challenge.sponsor ?? '',
        supporter: challenge.supporter ?? '',
        targetOther: challenge.targetOther ?? '',
        attachments: challenge.attachments ?? [],
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
        summary: challenge.summary ?? '',
        hashtags: (challenge.hashtags ?? []).join(', '),
        topics: challenge.topics ?? [],
        inquiryContact: challenge.inquiryContact ?? '',
        visibility: challenge.visibility === 'private' ? 'private' : 'public',
      }}
      submitLabel="수정 저장"
      submittingLabel="저장 중…"
      onSubmit={async (values) => {
        await updateChallenge.mutateAsync({ id, data: values });
        await queryClient.invalidateQueries({ queryKey: generated.getGetMyChallengeQueryKey(id) });
        toast.success('공고를 수정했습니다');
        router.push(hrefOf(`/postings/${id}`));
      }}
    />
  );
}

type Attachment = { fileId: string; name: string; size: number };

type PostingInput = {
  title: string;
  description: string;
  /** Figma 폼에는 참가비 입력이 없어 신규는 0, 수정은 기존 값을 그대로 보존한다. */
  price: number;
  /** 접수 기간 — datetime-local 값(YYYY-MM-DDTHH:mm). */
  startDate: string;
  endDate: string;
  /** 행사 기간 — date 값(YYYY-MM-DD). 비우면 미정. */
  eventStartDate: string;
  eventEndDate: string;
  host: string;
  supervisor: string;
  sponsor: string;
  supporter: string;
  targetOther: string;
  attachments: Attachment[];
  category: string;
  posterUrl?: string | null;
  thumbnailFileId?: string | null;
  targets: NonNullable<generated.UpdateChallengeMutationBody['targets']>;
  organizerType: (typeof organizerTypes)[number] | null;
  prizeAmount: string;
  recruitMethod?: 'seMOchall' | 'external';
  recruitUrl?: string;
  summary?: string;
  hashtags?: string;
  topics?: string[];
  inquiryContact?: string;
  visibility?: 'public' | 'private';
};
// 생성/수정 API의 본문 타입과 1:1로 맞춘다 — `as` 캐스트 없이 mutate에 그대로 넘긬다.
// 폼에서 항상 값이 있는 핵심 필드는 필수로 좁혀, 수기 create 클라이언트의 Pick<Challenge, ...> 계약에도 맞는다.
type PostingValues = generated.UpdateChallengeMutationBody & {
  title: string;
  description: string;
  price: number;
  startDate: string;
  endDate: string;
  host: string;
  supervisor?: string | null;
  sponsor?: string | null;
  supporter?: string | null;
  targetOther?: string | null;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  attachments: Attachment[];
  category: string | null;
  recruitMethod?: 'seMOchall' | 'external';
  recruitUrl?: string;
  summary?: string | null;
  hashtags?: string[] | null;
  topics?: string[] | null;
  inquiryContact?: string | null;
  visibility?: 'public' | 'private';
};

const EMPTY_POSTING: PostingInput = {
  title: '',
  description: '',
  price: 0,
  startDate: '',
  endDate: '',
  eventStartDate: '',
  eventEndDate: '',
  host: '',
  supervisor: '',
  sponsor: '',
  supporter: '',
  targetOther: '',
  attachments: [],
  category: '',
  targets: [],
  organizerType: null,
  prizeAmount: '',
  visibility: 'public',
};

const categoryDropdownOptions: DropdownOption[] = categories.map((x) => ({ value: x, label: x }));
const organizerTypeOptions: DropdownOption[] = organizerTypes.map((x) => ({ value: x, label: x }));

// 상세정보는 정화된 HTML로 저장한다(서버가 저장 시 한 번 더 정화). 글자 크기·색·글꼴·정렬은 허용된 style 값으로만 저장된다.
// TODO: https://developer.mozilla.org/docs/Web/API/Document/execCommand
const EDITOR_COMMANDS = {
  undo: 'undo',
  redo: 'redo',
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strikeThrough',
  superscript: 'superscript',
  subscript: 'subscript',
  clear: 'removeFormat',
  bullet: 'insertUnorderedList',
  number: 'insertOrderedList',
  alignLeft: 'justifyLeft',
  alignCenter: 'justifyCenter',
  alignRight: 'justifyRight',
  alignJustify: 'justifyFull',
  quote: 'formatBlock',
  rule: 'insertHorizontalRule',
} as const;
type EditorCommand = keyof typeof EDITOR_COMMANDS | 'image' | 'code';
// execCommand가 인라인 style(text-align 등)로 결과를 만들어야 하는 명령. 나머지는 b/i/u 같은 태그로 만든다.
const STYLE_COMMANDS = new Set<string>([
  'justifyLeft',
  'justifyCenter',
  'justifyRight',
  'justifyFull',
]);

type ParagraphStyle = 'p' | 'h2' | 'h3';
const PARAGRAPH_STYLES: { value: ParagraphStyle; label: string }[] = [
  { value: 'p', label: '본문' },
  { value: 'h2', label: '제목' },
  { value: 'h3', label: '소제목' },
];
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48];
const FONT_FAMILIES = [
  { value: '', label: '기본 글꼴' },
  { value: "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif", label: '고딕' },
  { value: "'Nanum Myeongjo', Batang, serif", label: '명조' },
  { value: "'Nanum Pen Script', cursive", label: '손글씨' },
  { value: "'Courier New', monospace", label: '고정폭' },
];

const ATTACHMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  hwp: 'application/x-hwp',
  hwpx: 'application/hwp+zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};
const ATTACHMENT_ACCEPT = Object.keys(ATTACHMENT_TYPES)
  .map((ext) => `.${ext}`)
  .join(',');
const POSTER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// 카드 썸네일 슬롯 비율 — 크롭 모달 프레임과 OCR 위치 계산이 같이 쓴다.
const POSTER_THUMBNAIL_ASPECT = 416 / 415;
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function attachmentContentType(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ATTACHMENT_TYPES[ext];
}

/** 호버(또는 키보드 포커스)하면 이름을 말풍선으로 보여준다. */
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return <TipWrap data-tip={label}>{children}</TipWrap>;
}

function ToolBtn({
  label,
  icon,
  glyph,
  command,
  onRun,
}: {
  label: string;
  icon?: string;
  glyph?: React.ReactNode;
  command?: EditorCommand;
  onRun: (command: EditorCommand) => void;
}) {
  return (
    <Tip label={label}>
      <ToolButton
        type="button"
        aria-label={label}
        disabled={!command}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => command && onRun(command)}
      >
        {icon ? <ToolIcon src={`${ICON}/${icon}`} alt="" /> : glyph}
      </ToolButton>
    </Tip>
  );
}

function AlignGlyph({ kind }: { kind: 'left' | 'center' | 'right' | 'justify' }) {
  const lines: [number, number][] = {
    left: [
      [3, 17],
      [3, 11],
      [3, 17],
      [3, 8],
    ],
    center: [
      [3, 17],
      [6, 14],
      [3, 17],
      [7, 13],
    ],
    right: [
      [3, 17],
      [9, 17],
      [3, 17],
      [12, 17],
    ],
    justify: [
      [3, 17],
      [3, 17],
      [3, 17],
      [3, 17],
    ],
  }[kind] as [number, number][];
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      {lines.map(([x1, x2], i) => (
        <line
          key={i}
          x1={x1}
          x2={x2}
          y1={5 + i * 3.5}
          y2={5 + i * 3.5}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

const keepEditorFocus = (event: React.MouseEvent) => event.preventDefault();

// 본문 글자에 칠하는 사용자 콘텐츠 색이라 디자인 토큰과 별개의 고정 팔레트를 쓴다.
const TEXT_COLORS = [
  '#000000',
  '#6b7280',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#0ea5e9',
  '#2563eb',
  '#8b5cf6',
  '#ec4899',
];
const HIGHLIGHT_COLORS = [
  '#fef08a',
  '#bbf7d0',
  '#bae6fd',
  '#fbcfe8',
  '#fed7aa',
  '#e9d5ff',
  '#e5e7eb',
  'transparent',
];

/**
 * 글자색·배경색 팔레트. 브라우저 기본 색상 선택 팝업은 창 포커스를 가져가 에디터에 서식이 적용되지 않으므로,
 * 페이지 안의 버튼으로 고르고 마우스다운의 포커스 이동을 막아 에디터 선택 영역을 유지한다.
 */
function ColorPalette({
  label,
  mark,
  colors,
  current,
  onPick,
}: {
  label: string;
  mark: string;
  colors: string[];
  current: string;
  onPick: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const isHighlight = mark === '가';
  return (
    <Tip label={label}>
      <PaletteRoot ref={rootRef} onMouseDown={keepEditorFocus}>
        <PaletteTrigger
          type="button"
          aria-label={label}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <ColorMark
            style={
              isHighlight
                ? { background: current === 'transparent' ? undefined : current }
                : { borderBottomColor: current }
            }
          >
            {mark}
          </ColorMark>
        </PaletteTrigger>
        {open && (
          <PaletteGrid role="listbox" aria-label={`${label} 선택`}>
            {colors.map((color) => (
              <Swatch
                key={color}
                type="button"
                role="option"
                aria-selected={color === current}
                aria-label={color === 'transparent' ? `${label} 없음` : `${label} ${color}`}
                title={color === 'transparent' ? '없음' : undefined}
                none={color === 'transparent'}
                selected={color === current}
                style={{ background: color === 'transparent' ? undefined : color }}
                onClick={() => {
                  onPick(color);
                  setOpen(false);
                }}
              />
            ))}
          </PaletteGrid>
        )}
      </PaletteRoot>
    </Tip>
  );
}

const HOURS: DropdownOption[] = Array.from({ length: 24 }, (_, h) => ({
  value: String(h).padStart(2, '0'),
  label: `${String(h).padStart(2, '0')}시`,
}));
const MINUTES: DropdownOption[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i * 5).padStart(2, '0'),
  label: `${String(i * 5).padStart(2, '0')}분`,
}));

/** 날짜(선택 시 시각까지) 입력. 값은 `YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm`(비어 있으면 ''). */
function DatePickerField({
  value,
  onChange,
  withTime = false,
  defaultTime = '00:00',
  invalid = false,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
  defaultTime?: string;
  invalid?: boolean;
  'aria-label': string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const datePart = value.slice(0, 10);
  const timePart = value.length > 10 ? value.slice(11, 16) : defaultTime;
  const [hour = '00', minute = '00'] = timePart.split(':');
  const selected = datePart ? new Date(`${datePart}T00:00:00`) : undefined;
  const [viewMonth, setViewMonth] = useState<Date>(() => selected ?? new Date());

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const emit = (date: string, time: string) => onChange(withTime ? `${date}T${time}` : date);
  const label = datePart
    ? `${datePart.replaceAll('-', '.')}${withTime ? ` ${hour}:${minute}` : ''}`
    : '날짜 선택';

  return (
    <PickerRoot ref={rootRef}>
      <PickerTrigger
        type="button"
        aria-label={ariaLabel}
        aria-invalid={invalid}
        aria-expanded={open}
        hasValue={Boolean(datePart)}
        onClick={() => {
          if (!open) setViewMonth(selected ?? new Date());
          setOpen((v) => !v);
        }}
      >
        {label}
      </PickerTrigger>
      {open && (
        <PickerPopover role="dialog" aria-label={`${ariaLabel} 달력`}>
          <PickerDayPicker
            mode="single"
            locale={ko}
            navLayout="around"
            selected={selected}
            month={viewMonth}
            onMonthChange={setViewMonth}
            onSelect={(date) => {
              if (!date) return;
              emit(toDateKey(date), `${hour}:${minute}`);
              if (!withTime) setOpen(false);
            }}
          />
          {withTime && (
            <PickerTime>
              <Dropdown
                size="S"
                width={92}
                aria-label={`${ariaLabel} 시`}
                options={HOURS}
                value={hour}
                onChange={(h) => datePart && emit(datePart, `${h}:${minute}`)}
                disabled={!datePart}
              />
              <Dropdown
                size="S"
                width={92}
                aria-label={`${ariaLabel} 분`}
                options={MINUTES}
                value={MINUTES.some((m) => m.value === minute) ? minute : undefined}
                placeholder={`${minute}분`}
                onChange={(m) => datePart && emit(datePart, `${hour}:${m}`)}
                disabled={!datePart}
              />
              <PickerDone type="button" onClick={() => setOpen(false)}>
                확인
              </PickerDone>
            </PickerTime>
          )}
        </PickerPopover>
      )}
    </PickerRoot>
  );
}

/**
 * 한글 등 IME 조합 중의 Enter는 글자 확정용이다. 이때 적용하면 팝오버가 닫히며 조합 중이던 마지막 글자가
 * 에디터에 한 번 더 들어가므로, 조합이 끝난 뒤의 Enter만 적용으로 처리한다.
 */
const isPlainEnter = (event: React.KeyboardEvent) =>
  event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229;

/** 주소에 스킴이 없으면 https://를 붙여 http(s) URL로 정규화한다. 올바르지 않으면 null. */
function normalizeLinkUrl(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  const url = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  return isHttpUrl(url) ? url : null;
}

/**
 * 링크 버튼 + 팝오버. 선택한 글자에 링크를 걸거나(선택이 없으면 표시 글자와 함께 삽입),
 * 커서가 링크 안이면 주소를 고치거나 해제한다. 입력창이 포커스를 가져가므로 기억해 둔 선택 영역을 복원해 적용한다.
 */
function LinkTool({
  savedRange,
  withEditorSelection,
}: {
  savedRange: React.RefObject<Range | null>;
  withEditorSelection: (apply: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [existing, setExisting] = useState<HTMLAnchorElement | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    urlRef.current?.focus();
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const toggle = () => {
    if (open) return setOpen(false);
    const range = savedRange.current;
    const node = range?.commonAncestorContainer;
    const anchor = (node instanceof Element ? node : node?.parentElement)?.closest('a') ?? null;
    setExisting(anchor);
    setHasSelection(Boolean(range && !range.collapsed));
    setUrl(anchor?.getAttribute('href') ?? '');
    setText('');
    setError('');
    setOpen(true);
  };

  const apply = () => {
    const normalized = normalizeLinkUrl(url);
    if (!normalized) return setError('http(s)://로 시작하는 올바른 주소를 입력해 주세요.');
    if (existing) existing.setAttribute('href', normalized);
    else
      withEditorSelection(() => {
        if (hasSelection) document.execCommand('createLink', false, normalized);
        else
          document.execCommand(
            'insertHTML',
            false,
            `<a href="${escapeHtml(normalized).replace(/"/g, '&quot;')}">${escapeHtml(text.trim() || normalized)}</a>`,
          );
      });
    setOpen(false);
  };

  const remove = () => {
    withEditorSelection(() => {
      if (existing) {
        const range = document.createRange();
        range.selectNodeContents(existing);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      document.execCommand('unlink');
    });
    setOpen(false);
  };

  return (
    <LinkRoot ref={rootRef}>
      <Tip label="링크">
        <ToolButton
          type="button"
          aria-label="링크"
          aria-expanded={open}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggle}
        >
          <ToolIcon src={`${ICON}/figma-link.svg`} alt="" />
        </ToolButton>
      </Tip>
      {open && (
        <LinkPopover
          role="dialog"
          aria-label="링크 편집"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        >
          <LinkField>
            <LinkLabel htmlFor="link-url">링크 주소</LinkLabel>
            <LinkInputBox
              id="link-url"
              ref={urlRef}
              value={url}
              placeholder="https://"
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setUrl(event.target.value);
                setError('');
              }}
              onKeyDown={(event) => {
                if (isPlainEnter(event)) {
                  event.preventDefault();
                  apply();
                }
              }}
            />
          </LinkField>
          {!existing && !hasSelection && (
            <LinkField>
              <LinkLabel htmlFor="link-text">표시할 글자 (선택)</LinkLabel>
              <LinkInputBox
                id="link-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (isPlainEnter(event)) {
                    event.preventDefault();
                    apply();
                  }
                }}
              />
            </LinkField>
          )}
          {error && <LinkError role="alert">{error}</LinkError>}
          <LinkActions>
            {existing && (
              <LinkGhost type="button" onClick={remove}>
                링크 해제
              </LinkGhost>
            )}
            <LinkGhost type="button" onClick={() => setOpen(false)}>
              취소
            </LinkGhost>
            <LinkApply type="button" onClick={apply}>
              {existing ? '수정' : '적용'}
            </LinkApply>
          </LinkActions>
        </LinkPopover>
      )}
    </LinkRoot>
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
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [eventStartDate, setEventStartDate] = useState(initial.eventStartDate);
  const [eventEndDate, setEventEndDate] = useState(initial.eventEndDate);
  const [host, setHost] = useState(initial.host);
  const [supervisor, setSupervisor] = useState(initial.supervisor);
  const [sponsor, setSponsor] = useState(initial.sponsor);
  const [supporter, setSupporter] = useState(initial.supporter);
  const [targetOther, setTargetOther] = useState(initial.targetOther);
  const [attachments, setAttachments] = useState<Attachment[]>(initial.attachments);
  const [preview, setPreview] = useState<PostingPreview | null>(null);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [textColor, setTextColor] = useState('#000000');
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0]!);
  const [category, setCategory] = useState(initial.category);
  const [targets, setTargets] = useState(initial.targets);
  const [organizerType, setOrganizerType] = useState(initial.organizerType);
  const [prizeAmount, setPrizeAmount] = useState(initial.prizeAmount);
  // 포스터는 크롭 모달에서 썸네일 영역까지 함께 확정된 뒤 원본+썸네일을 같이 올린다.
  const [poster, setPoster] = useState<{
    posterFileId: string;
    thumbnailFileId: string;
    previewUrl: string;
  } | null>(null);
  const existingPosterUrl = initial.posterUrl ?? null;
  const [pendingPoster, setPendingPoster] = useState<CropImage | null>(null);
  // OCR 자동 추천 위치 — 포스터를 고른 뒤 백그라운드 인식이 끝나면 늦게 세팅된다.
  const [posterAutoPosition, setPosterAutoPosition] = useState<Position | null>(null);
  // 진행 중인 OCR이 어떤 파일 것인지 구분해, 새 파일을 고른 뒤 늦게 끝나도 덮어쓰지 않게 한다.
  const posterPickSeq = useRef(0);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const posterObjectUrl = useRef<string | null>(null);
  const [recruit, setRecruit] = useState<'semo' | 'external'>(
    initial.recruitMethod === 'external' ? 'external' : 'semo',
  );
  const [recruitUrl, setRecruitUrl] = useState(initial.recruitUrl ?? '');
  const [summary, setSummary] = useState(initial.summary ?? '');
  const [hashtags, setHashtags] = useState(initial.hashtags ?? '');
  const [topics, setTopics] = useState<string[]>(initial.topics ?? []);
  const [inquiryContact, setInquiryContact] = useState(initial.inquiryContact ?? '');
  const [visibility, setVisibility] = useState<'public' | 'private'>(
    initial.visibility ?? 'public',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // 검증에 실패한 필드(빨간 테두리로 표시). 해당 필드를 고치기 시작하면 그 필드만 해제한다.
  const [invalid, setInvalid] = useState<ReadonlySet<string>>(new Set());
  const isInvalid = (key: string) => invalid.has(key);
  const clearInvalid = (...keys: string[]) =>
    setInvalid((prev) =>
      keys.some((k) => prev.has(k)) ? new Set([...prev].filter((k) => !keys.includes(k))) : prev,
    );
  const fail = (keys: string[], message: string) => {
    setInvalid(new Set(keys));
    setError(message);
  };
  const shownError = error || initialError;
  // 저장된 카테고리가 선택지에 없으면(과거 값 등) 사라지지 않도록 옵션에 포함한다.
  const dropdownOptions =
    initial.category && !categories.includes(initial.category)
      ? [{ value: initial.category, label: initial.category }, ...categoryDropdownOptions]
      : categoryDropdownOptions;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    // 서식 저장 도입 전의 평문 공고는 텍스트로, 이후 공고는 정화한 HTML로 불러온다.
    if (isRichHtml(initial.description)) editor.innerHTML = sanitizeRichHtml(initial.description);
    else editor.innerText = initial.description;
  }, [initial.description]);
  const pendingPosterRef = useRef<CropImage | null>(null);
  useEffect(() => {
    // 언마운트 정리에서 최신 값을 보기 위해 ref로 미러링한다.
    pendingPosterRef.current = pendingPoster;
  }, [pendingPoster]);
  useEffect(
    () => () => {
      if (posterObjectUrl.current) URL.revokeObjectURL(posterObjectUrl.current);
      if (pendingPosterRef.current) URL.revokeObjectURL(pendingPosterRef.current.url);
    },
    [],
  );

  const toggleTopic = (topic: string) =>
    setTopics((s) => (s.includes(topic) ? s.filter((x) => x !== topic) : [...s, topic]));
  const toggleTarget = (target: (typeof challengeTargets)[number]) =>
    setTargets((s) => (s.includes(target) ? s.filter((x) => x !== target) : [...s, target]));
  // 크기 드롭다운이 포커스를 가져가면 에디터 선택이 풀리므로, 마지막 선택 영역을 기억했다가 복원한다.
  const savedRange = useRef<Range | null>(null);
  useEffect(() => {
    const remember = () => {
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (range && editorRef.current?.contains(range.commonAncestorContainer))
        savedRange.current = range.cloneRange();
    };
    document.addEventListener('selectionchange', remember);
    return () => document.removeEventListener('selectionchange', remember);
  }, []);
  // 드롭다운·색상 선택이 포커스를 가져가 선택 영역이 풀리므로, 기억해 둔 영역을 되살린 뒤 서식을 적용한다.
  const withEditorSelection = (apply: () => void) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    if (savedRange.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange.current);
    }
    apply();
  };
  const applyStyled = (command: string, value?: string) => {
    // style 속성으로 결과를 만들어야 하는 명령만 잠깐 켠다(굵게 등은 b/i/u 태그를 유지).
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    document.execCommand('styleWithCSS', false, 'false');
  };
  const applyParagraphStyle = (style: ParagraphStyle) =>
    withEditorSelection(() => void document.execCommand('formatBlock', false, style));
  const applyFontFamily = (family: string) =>
    withEditorSelection(() => {
      if (family) applyStyled('fontName', family);
      else document.execCommand('removeFormat');
    });
  const applyColor = (command: 'foreColor' | 'hiliteColor', color: string) =>
    withEditorSelection(() => applyStyled(command, color));
  // execCommand는 1~7단계 크기만 지원하므로, 최대 단계(7)로 감싼 뒤 고른 px 값의 span으로 바꾼다.
  const applyFontSize = (px: number) =>
    withEditorSelection(() => {
      const editor = editorRef.current;
      if (!editor) return;
      document.execCommand('fontSize', false, '7');
      editor.querySelectorAll('font[size="7"]').forEach((node) => {
        const span = document.createElement('span');
        span.style.fontSize = `${px}px`;
        span.append(...node.childNodes);
        node.replaceWith(span);
      });
    });
  const runCommand = (command: EditorCommand) => {
    withEditorSelection(() => {});
    if (command === 'image') return imageInputRef.current?.click();
    if (command === 'code') {
      const selected = window.getSelection()?.toString() ?? '';
      if (!selected) return;
      return void document.execCommand('insertHTML', false, `<code>${escapeHtml(selected)}</code>`);
    }
    if (command === 'quote') return void document.execCommand('formatBlock', false, 'blockquote');
    const native = EDITOR_COMMANDS[command];
    if (STYLE_COMMANDS.has(native)) return applyStyled(native);
    document.execCommand(native);
  };

  // 파일 선택 창이 열리면 에디터 선택 영역이 사라지므로 미리 기억했다가 이미지를 그 자리에 넣는다.
  const insertImage = async (file: File) => {
    if (uploadingImage) return;
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    setUploadingImage(true);
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
      const finalized = await adApi.files.finalizeUpload(presigned.fileId);
      if (!finalized.url) throw new globalThis.Error('이미지 주소를 받지 못했습니다.');
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      if (range && editor.contains(range.commonAncestorContainer)) {
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      document.execCommand('insertImage', false, finalized.url);
    } catch {
      setError('이미지 업로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      if (image) URL.revokeObjectURL(image.previewUrl);
      setUploadingImage(false);
    }
  };

  // 파일을 고르는 즉시 썸네일 크롭 모달을 연다 — 확인 시에만 업로드가 시작된다.
  const choosePoster = async (file: File) => {
    if (uploadingPoster) return;
    if (!POSTER_TYPES.includes(file.type))
      return setError('포스터는 JPG, PNG, WebP 이미지만 올릴 수 있습니다.');
    if (file.size > MAX_ATTACHMENT_BYTES) return setError('포스터는 10MB 이하만 올릴 수 있습니다.');
    setError('');
    try {
      const image = await readImage(file);
      setPendingPoster(image);
      // 이전 파일의 자동 추천이 남지 않게 먼저 비우고, 새 선택의 OCR만 적용되게 표시한다.
      const pickSeq = ++posterPickSeq.current;
      setPosterAutoPosition(null);
      // 모달은 즉시 열고(중앙 시작) 백그라운드에서 OCR을 돌린다. 제목과 본문 innerText를
      // 함께 넣어 포스터에 적힌 공고 글자가 썸네일 중심이 되도록 위치를 추천한다.
      // 인식 실패·매칭 없음은 null로 끝나 기존처럼 중앙을 그대로 쓴다(실패는 경고 로그만 남긴다).
      void recommendPosterCropPosition(
        image,
        [title.trim(), editorRef.current?.innerText ?? ''].filter((text) => text.trim().length > 0),
        POSTER_THUMBNAIL_ASPECT,
      ).then((position) => {
        if (position && posterPickSeq.current === pickSeq) {
          setPosterAutoPosition(position);
        }
      });
    } catch (cause) {
      setPendingPoster(null);
      setError(cropErrorMessage(cause));
    }
  };
  const cancelPosterCrop = () => {
    posterPickSeq.current += 1;
    setPosterAutoPosition(null);
    if (pendingPosterRef.current) URL.revokeObjectURL(pendingPosterRef.current.url);
    setPendingPoster(null);
  };
  // 모달에서 크롭을 확정하면 원본 포스터와 잘라낸 썸네일 WebP를 함께 올린다.
  const confirmPosterCrop = async (thumbnail: File) => {
    const pending = pendingPosterRef.current;
    posterPickSeq.current += 1;
    setPosterAutoPosition(null);
    if (pending) URL.revokeObjectURL(pending.url);
    setPendingPoster(null);
    if (!pending) return;
    await uploadPoster(pending.file, thumbnail);
  };

  // 포스터는 압축·리사이즈·변환 없이 원본 파일 그대로 올린다(서버가 purpose=poster일 때만 원본을 보존).
  // 썸네일은 크롭 결과 WebP라 purpose 없이 올려도 서버가 그대로 받는다.
  const uploadPoster = async (file: File, thumbnail: File) => {
    if (uploadingPoster) return;
    setError('');
    setUploadingPoster(true);
    try {
      const [presignedPoster, presignedThumbnail] = await Promise.all([
        adApi.files.requestUpload({
          bucket: 'public',
          purpose: 'poster',
          contentType: file.type,
          fileName: file.name,
          sizeBytes: file.size,
        }),
        adApi.files.requestUpload({
          bucket: 'public',
          contentType: thumbnail.type,
          fileName: thumbnail.name,
          sizeBytes: thumbnail.size,
        }),
      ]);
      const [posterResponse, thumbnailResponse] = await Promise.all([
        fetch(presignedPoster.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        }),
        fetch(presignedThumbnail.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': thumbnail.type },
          body: thumbnail,
        }),
      ]);
      if (!posterResponse.ok || !thumbnailResponse.ok)
        throw new globalThis.Error('이미지 업로드에 실패했습니다.');
      await Promise.all([
        adApi.files.finalizeUpload(presignedPoster.fileId),
        adApi.files.finalizeUpload(presignedThumbnail.fileId),
      ]);
      // 둘 다 성공한 뒤에만 폼 상태를 교체한다 — 하나만 올라간 부분 상태를 남기지 않는다.
      // 원본은 보관용이고, 작성 화면에서는 사용자가 확정한 크롭 썸네일을 그대로 보여준다.
      const previewUrl = URL.createObjectURL(thumbnail);
      if (posterObjectUrl.current) URL.revokeObjectURL(posterObjectUrl.current);
      posterObjectUrl.current = previewUrl;
      setPoster({
        posterFileId: presignedPoster.fileId,
        thumbnailFileId: presignedThumbnail.fileId,
        previewUrl,
      });
    } catch {
      setError('포스터 업로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setUploadingPoster(false);
    }
  };

  const uploadAttachments = async (selected: File[]) => {
    if (uploadingAttachments || selected.length === 0) return;
    if (attachments.length + selected.length > MAX_ATTACHMENTS)
      return setError(`첨부파일은 최대 ${MAX_ATTACHMENTS}개까지 올릴 수 있습니다.`);
    const rejected = selected.find((file) => !attachmentContentType(file));
    if (rejected)
      return setError(`${rejected.name}: 지원하지 않는 파일 형식입니다. (PDF, 문서, 압축, 이미지)`);
    const oversized = selected.find((file) => file.size > MAX_ATTACHMENT_BYTES);
    if (oversized) return setError(`${oversized.name}: 파일은 10MB 이하만 올릴 수 있습니다.`);
    setError('');
    setUploadingAttachments(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of selected) {
        const contentType = attachmentContentType(file)!;
        const presigned = await adApi.files.requestUpload({
          bucket: 'private',
          contentType,
          fileName: file.name,
          sizeBytes: file.size,
        });
        const response = await fetch(presigned.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: file,
        });
        if (!response.ok) throw new globalThis.Error('파일 업로드에 실패했습니다.');
        await adApi.files.finalizeUpload(presigned.fileId);
        uploaded.push({ fileId: presigned.fileId, name: file.name, size: file.size });
      }
      setAttachments((current) => [...current, ...uploaded]);
    } catch {
      setError('첨부파일 업로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setUploadingAttachments(false);
    }
  };

  // 현재 입력값으로 상세 페이지 미리보기를 만든다(저장 없음). 본문은 게시 때와 같이 정화한다.
  const openPreview = () => {
    const editor = editorRef.current;
    const hasContent = Boolean(editor?.querySelector('img')) || Boolean(editor?.innerText.trim());
    setPreview({
      posterUrl: poster?.previewUrl ?? existingPosterUrl,
      title: title.trim(),
      host: host.trim(),
      supervisor: supervisor.trim(),
      sponsor: sponsor.trim(),
      supporter: supporter.trim(),
      eligibility: targets
        .map((target) => (target === '기타' && targetOther.trim() ? targetOther.trim() : target))
        .join(', '),
      category,
      topics,
      startDate,
      endDate,
      eventStartDate,
      eventEndDate,
      summary: summary.trim(),
      hashtags: hashtags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      descriptionHtml: hasContent ? sanitizeRichHtml(editor?.innerHTML ?? '').trim() : '',
      attachments,
      inquiryContact: inquiryContact.trim(),
      externalUrl: recruit === 'external' ? recruitUrl.trim() || null : null,
    });
  };

  async function submit() {
    setError('');
    setInvalid(new Set());
    const editor = editorRef.current;
    const hasContent = Boolean(editor?.querySelector('img')) || Boolean(editor?.innerText.trim());
    const description = hasContent ? sanitizeRichHtml(editor?.innerHTML ?? '').trim() : '';
    const parsedPrizeAmount = prizeAmount === '' ? null : Number(prizeAmount);
    const missing = [
      !title.trim() && 'title',
      !description && 'description',
      !startDate && 'startDate',
      !endDate && 'endDate',
    ].filter((key): key is string => Boolean(key));
    if (missing.length) return fail(missing, '제목, 상세정보, 접수 기간을 입력해 주세요.');
    if (!host.trim()) return fail(['host'], '주최를 입력해 주세요.');
    if (Boolean(eventStartDate) !== Boolean(eventEndDate))
      return fail(
        [eventStartDate ? 'eventEndDate' : 'eventStartDate'],
        '행사 기간은 시작일과 종료일을 함께 입력해 주세요.',
      );
    if (eventStartDate && eventEndDate < eventStartDate)
      return fail(['eventEndDate'], '행사 종료일은 시작일 이후여야 합니다.');
    if (
      parsedPrizeAmount !== null &&
      (!Number.isInteger(parsedPrizeAmount) || parsedPrizeAmount < 0)
    )
      return fail(['prizeAmount'], '총상금은 0 이상의 정수(만원)로 입력해 주세요.');
    if (endDate < startDate)
      return fail(['endDate'], '접수 종료 시각은 시작 시각 이후여야 합니다.');
    const trimmedRecruitUrl = recruitUrl.trim();
    const normalizedHashtags = [
      ...new Set(
        hashtags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ];
    // 서버 DTO 한도(description 100,000자(서식 포함) / hashtags 20개·각 50자)를 미리 검사해 이해 가능한 문구로 안내한다.
    if (description.length > 100_000)
      return fail(['description'], '상세정보가 너무 깁니다. 내용을 줄여 주세요.');
    if (normalizedHashtags.length > 20)
      return fail(['hashtags'], '해시태그는 최대 20개까지 입력할 수 있습니다.');
    if (normalizedHashtags.some((tag) => tag.length > 50))
      return fail(['hashtags'], '해시태그는 각 50자 이하로 입력해 주세요.');
    if (recruit === 'external') {
      if (!trimmedRecruitUrl) return fail(['recruitUrl'], '외부 지원 링크 URL을 입력해 주세요.');
      if (!isHttpUrl(trimmedRecruitUrl))
        return fail(
          ['recruitUrl'],
          '외부 지원 링크는 http(s)://로 시작하는 올바른 URL이어야 합니다.',
        );
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description,
        price: initial.price,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        eventStartDate: eventStartDate ? toLocalBoundary(eventStartDate, false) : null,
        eventEndDate: eventEndDate ? toLocalBoundary(eventEndDate, true) : null,
        host: host.trim(),
        supervisor: supervisor.trim() || null,
        sponsor: sponsor.trim() || null,
        supporter: supporter.trim() || null,
        targetOther: targets.includes('기타') ? targetOther.trim() || null : null,
        attachments,
        category: category || null,
        targets,
        organizerType: organizerType || null,
        prizeAmount: parsedPrizeAmount,
        ...(poster
          ? { posterFileId: poster.posterFileId, thumbnailFileId: poster.thumbnailFileId }
          : {}),
        ...(showRecruitMethod
          ? { recruitMethod: recruit === 'semo' ? 'seMOchall' : 'external' }
          : {}),
        ...(recruit === 'external' ? { recruitUrl: trimmedRecruitUrl } : {}),
        summary: summary.trim() || null,
        hashtags: normalizedHashtags,
        topics,
        inquiryContact: inquiryContact.trim() || null,
        visibility,
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
            if (file) void choosePoster(file);
          }}
        />
        {poster?.previewUrl || existingPosterUrl ? (
          <>
            <PosterPreview
              src={poster?.previewUrl ?? existingPosterUrl ?? ''}
              alt="포스터 미리보기"
              cropped={Boolean(poster)}
            />
            <UploadText>선택한 썸네일 영역이 표시됩니다</UploadText>
          </>
        ) : (
          <>
            <UploadMark src={`${ICON}/fileuploader.png`} alt="" />
            <UploadText>파일 찾기</UploadText>
          </>
        )}
        {uploadingPoster && <UploadText>포스터를 업로드하는 중입니다…</UploadText>}
      </Uploader>
      {pendingPoster ? (
        <ImageCropModal
          image={pendingPoster}
          aspectRatio={POSTER_THUMBNAIL_ASPECT}
          previewWidth={400}
          title="썸네일 영역 선택"
          description="드래그해서 카드에 보일 영역을 지정한 뒤 확인해주세요. 원본 포스터는 그대로 유지됩니다."
          previewAlt="포스터 썸네일 자르기 미리보기"
          autoPosition={posterAutoPosition}
          onCancel={cancelPosterCrop}
          onConfirm={(file) => void confirmPosterCrop(file)}
        />
      ) : null}

      <Body>
        <TitleSection>
          <TitleInput
            placeholder="제목을 입력해주세요"
            aria-label="공고 제목"
            value={title}
            maxLength={200}
            aria-invalid={isInvalid('title')}
            onChange={(e) => {
              setTitle(e.target.value);
              clearInvalid('title');
            }}
          />
          <Roles aria-label="접수 기간과 행사 기간">
            <RoleRow>
              <RoleLabel>접수 기간</RoleLabel>
              <DatePickerField
                withTime
                defaultTime="00:00"
                value={startDate}
                onChange={(v) => {
                  setStartDate(v);
                  clearInvalid('startDate');
                }}
                invalid={isInvalid('startDate')}
                aria-label="접수 시작 일시"
              />
              <RangeTilde>~</RangeTilde>
              <DatePickerField
                withTime
                defaultTime="23:59"
                value={endDate}
                onChange={(v) => {
                  setEndDate(v);
                  clearInvalid('endDate');
                }}
                invalid={isInvalid('endDate')}
                aria-label="접수 종료 일시"
              />
            </RoleRow>
            <RoleRow>
              <RoleLabel>행사 기간</RoleLabel>
              <DatePickerField
                value={eventStartDate}
                onChange={(v) => {
                  setEventStartDate(v);
                  clearInvalid('eventStartDate');
                }}
                invalid={isInvalid('eventStartDate')}
                aria-label="행사 시작일"
              />
              <RangeTilde>~</RangeTilde>
              <DatePickerField
                value={eventEndDate}
                onChange={(v) => {
                  setEventEndDate(v);
                  clearInvalid('eventEndDate');
                }}
                invalid={isInvalid('eventEndDate')}
                aria-label="행사 종료일"
              />
            </RoleRow>
          </Roles>
        </TitleSection>

        <Fields>
          <FieldBlock>
            <FieldLabel>설명문구를 적어주세요.</FieldLabel>
            <LineInput
              aria-label="설명문구"
              value={summary}
              maxLength={300}
              onChange={(e) => setSummary(e.target.value)}
            />
          </FieldBlock>
          <FieldBlock>
            <FieldLabel>해시태그를 적어주세요.</FieldLabel>
            <LineInput
              aria-label="해시태그"
              value={hashtags}
              aria-invalid={isInvalid('hashtags')}
              onChange={(e) => {
                setHashtags(e.target.value);
                clearInvalid('hashtags');
              }}
            />
          </FieldBlock>
          <FieldBlock>
            <FieldLabel>상세정보를 적어주세요.</FieldLabel>
            <EditorBox aria-invalid={isInvalid('description')}>
              <MenuBar role="toolbar" aria-label="텍스트 에디터">
                <ToolGroup borderless>
                  <Tip label="문단 스타일">
                    <ToolDrop onMouseDown={keepEditorFocus}>
                      <Dropdown
                        size="S"
                        width={88}
                        aria-label="문단 스타일"
                        value=""
                        placeholder="문단"
                        options={PARAGRAPH_STYLES}
                        onChange={(value) => applyParagraphStyle(value as ParagraphStyle)}
                      />
                    </ToolDrop>
                  </Tip>
                  <Tip label="글꼴">
                    <ToolDrop onMouseDown={keepEditorFocus}>
                      <Dropdown
                        size="S"
                        width={104}
                        aria-label="글꼴"
                        value=""
                        placeholder="글꼴"
                        options={FONT_FAMILIES.map(({ label }) => ({ value: label, label }))}
                        onChange={(value) => {
                          const family = FONT_FAMILIES.find((f) => f.label === value);
                          if (family) applyFontFamily(family.value);
                        }}
                      />
                    </ToolDrop>
                  </Tip>
                  <Tip label="글자 크기">
                    <ToolDrop onMouseDown={keepEditorFocus}>
                      <Dropdown
                        size="S"
                        width={88}
                        aria-label="글자 크기"
                        value=""
                        placeholder="크기"
                        options={FONT_SIZES.map((px) => ({ value: String(px), label: `${px}px` }))}
                        onChange={(value) => applyFontSize(Number(value))}
                      />
                    </ToolDrop>
                  </Tip>
                </ToolGroup>
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
                  <ToolBtn
                    onRun={runCommand}
                    label="인라인 코드"
                    icon="figma-code.svg"
                    command="code"
                  />
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
                    label="위 첨자"
                    glyph={<ScriptGlyph>x²</ScriptGlyph>}
                    command="superscript"
                  />
                  <ToolBtn
                    onRun={runCommand}
                    label="아래 첨자"
                    glyph={<ScriptGlyph>x₂</ScriptGlyph>}
                    command="subscript"
                  />
                  <ColorPalette
                    label="글자 색"
                    mark="A"
                    colors={TEXT_COLORS}
                    current={textColor}
                    onPick={(color) => {
                      setTextColor(color);
                      applyColor('foreColor', color);
                    }}
                  />
                  <ColorPalette
                    label="배경(형광펜) 색"
                    mark="가"
                    colors={HIGHLIGHT_COLORS}
                    current={highlightColor}
                    onPick={(color) => {
                      setHighlightColor(color);
                      applyColor('hiliteColor', color);
                    }}
                  />
                </ToolGroup>
                <ToolGroup>
                  <ToolBtn
                    onRun={runCommand}
                    label="왼쪽 정렬"
                    glyph={<AlignGlyph kind="left" />}
                    command="alignLeft"
                  />
                  <ToolBtn
                    onRun={runCommand}
                    label="가운데 정렬"
                    glyph={<AlignGlyph kind="center" />}
                    command="alignCenter"
                  />
                  <ToolBtn
                    onRun={runCommand}
                    label="오른쪽 정렬"
                    glyph={<AlignGlyph kind="right" />}
                    command="alignRight"
                  />
                  <ToolBtn
                    onRun={runCommand}
                    label="양쪽 정렬"
                    glyph={<AlignGlyph kind="justify" />}
                    command="alignJustify"
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
                  <LinkTool savedRange={savedRange} withEditorSelection={withEditorSelection} />
                  <ToolBtn
                    onRun={runCommand}
                    label="이미지"
                    icon="figma-image.svg"
                    command="image"
                  />
                  <ToolBtn onRun={runCommand} label="인용" icon="figma-quote.svg" command="quote" />
                  <ToolBtn onRun={runCommand} label="구분선" icon="figma-rule.svg" command="rule" />
                </ToolGroup>
              </MenuBar>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                aria-label="본문 이미지 선택"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void insertImage(file);
                }}
              />
              <ContentsArea
                ref={editorRef}
                onPaste={(event) => {
                  // 외부 서식·이미지가 섞여 들어오지 않게 텍스트만 붙여 넣는다.
                  event.preventDefault();
                  document.execCommand(
                    'insertText',
                    false,
                    event.clipboardData.getData('text/plain'),
                  );
                }}
                onInput={(event) => {
                  clearInvalid('description');
                  // 모두 지운 뒤 남는 <br>/<div> 때문에 placeholder(:empty)가 사라지는 것을 막는다.
                  const el = event.currentTarget;
                  if (!el.innerText.trim() && !el.querySelector('img,hr')) el.innerHTML = '';
                }}
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
            {targets.includes('기타') && (
              <LineInput
                aria-label="대상 기타 내용"
                value={targetOther}
                maxLength={100}
                onChange={(e) => setTargetOther(e.target.value)}
              />
            )}
          </FieldBlock>

          <TwoCol>
            <FieldBlock>
              <FieldLabel>주최 (필수)</FieldLabel>
              <LineInput
                aria-label="주최"
                value={host}
                maxLength={200}
                required
                aria-invalid={isInvalid('host')}
                onChange={(e) => {
                  setHost(e.target.value);
                  clearInvalid('host');
                }}
              />
            </FieldBlock>
            <FieldBlock>
              <FieldLabel>주관</FieldLabel>
              <LineInput
                aria-label="주관"
                value={supervisor}
                maxLength={200}
                onChange={(e) => setSupervisor(e.target.value)}
              />
            </FieldBlock>
          </TwoCol>
          <TwoCol>
            <FieldBlock>
              <FieldLabel>협찬</FieldLabel>
              <LineInput
                aria-label="협찬"
                value={sponsor}
                maxLength={200}
                onChange={(e) => setSponsor(e.target.value)}
              />
            </FieldBlock>
            <FieldBlock>
              <FieldLabel>후원</FieldLabel>
              <LineInput
                aria-label="후원"
                value={supporter}
                maxLength={200}
                onChange={(e) => setSupporter(e.target.value)}
              />
            </FieldBlock>
          </TwoCol>

          <TwoCol>
            <CategoryBlock>
              <FieldLabel>주최기관 유형</FieldLabel>
              <Dropdown
                options={organizerTypeOptions}
                value={organizerType || undefined}
                placeholder="선택 안 함"
                size="L"
                aria-label="주최기관 유형"
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
                aria-invalid={isInvalid('prizeAmount')}
                onChange={(e) => {
                  setPrizeAmount(e.target.value);
                  clearInvalid('prizeAmount');
                }}
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
                      aria-invalid={isInvalid('recruitUrl')}
                      onChange={(event) => {
                        setRecruitUrl(event.target.value);
                        clearInvalid('recruitUrl');
                      }}
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
                aria-invalid={isInvalid('recruitUrl')}
                onChange={(event) => {
                  setRecruitUrl(event.target.value);
                  clearInvalid('recruitUrl');
                }}
                placeholder="https://example.com/apply"
                required
              />
            </FieldBlock>
          )}

          <FieldBlock>
            <FieldLabel>첨부파일</FieldLabel>
            <FileUploader
              multiple
              accept={ATTACHMENT_ACCEPT}
              aria-label="첨부파일 선택"
              label={uploadingAttachments ? '업로드 중…' : '파일을 업로드해 주세요'}
              disabled={uploadingAttachments || attachments.length >= MAX_ATTACHMENTS}
              onFiles={(selected) => void uploadAttachments(selected)}
            />
            <AttachHint>
              PDF·한글·워드·엑셀·PPT·압축·이미지, 파일당 10MB 이하, 최대 {MAX_ATTACHMENTS}개
            </AttachHint>
            {attachments.length > 0 && (
              <AttachList aria-label="첨부파일 목록">
                {attachments.map((file) => (
                  <AttachItem key={file.fileId}>
                    <span>
                      {file.name} <small>({formatBytes(file.size)})</small>
                    </span>
                    <button
                      type="button"
                      aria-label={`${file.name} 삭제`}
                      onClick={() =>
                        setAttachments((list) => list.filter((x) => x.fileId !== file.fileId))
                      }
                    >
                      삭제
                    </button>
                  </AttachItem>
                ))}
              </AttachList>
            )}
          </FieldBlock>

          <FieldBlock>
            <FieldLabel>문의연락처</FieldLabel>
            <ContactInput
              aria-label="문의연락처"
              value={inquiryContact}
              maxLength={200}
              onChange={(e) => setInquiryContact(e.target.value)}
            />
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
        <CancelButton type="button" onClick={openPreview}>
          미리보기
        </CancelButton>
        <PublishButton
          type="button"
          disabled={
            disabled || submitting || uploadingPoster || uploadingImage || uploadingAttachments
          }
          onClick={() => void submit()}
        >
          {submitting ? submittingLabel : submitLabel}
        </PublishButton>
      </Actions>
      {preview && <PostingPreviewModal data={preview} onClose={() => setPreview(null)} />}
    </FormWrap>
  );
}

const PickerRoot = styled.div({ position: 'relative', flex: 1, minWidth: 0 });
const PickerTrigger = styled('button', { shouldForwardProp: (prop) => prop !== 'hasValue' })<{
  hasValue: boolean;
}>(({ hasValue }) => ({
  width: '100%',
  height: 32,
  border: `0.5px solid ${c.gray300}`,
  borderRadius: 8,
  padding: '0 14px',
  background: c.white,
  color: hasValue ? c.gray900 : c.gray500,
  textAlign: 'left',
  cursor: 'pointer',
  '&:hover, &[aria-expanded=true]': { borderColor: c.primary },
  '&[aria-invalid=true]': { borderColor: c.red },
}));
const PickerPopover = styled.div({
  position: 'absolute',
  zIndex: 30,
  top: 'calc(100% + 6px)',
  left: 0,
  width: 'max-content',
  padding: 14,
  borderRadius: 10,
  background: c.white,
  border: `0.5px solid ${c.gray200}`,
  boxShadow: '0 12px 28px rgba(17, 24, 39, .18)',
});
const PickerDayPicker = styled(DayPicker)({
  '--rdp-accent-color': c.primary,
  '--rdp-accent-background-color': c.lightBlue,
  '--rdp-today-color': c.primary,
  '--rdp-day-width': '34px',
  '--rdp-day-height': '34px',
  '--rdp-day_button-width': '32px',
  '--rdp-day_button-height': '32px',
  '--rdp-day_button-border': 'none',
  '--rdp-selected-border': 'none',
  '--rdp-nav_button-width': '24px',
  '--rdp-nav_button-height': '24px',
  '--rdp-nav-height': '28px',
  '--rdp-weekday-opacity': 1,
  fontFamily: textStyle.metaText.fontFamily,
  '.rdp-month_caption': { ...textStyle.subtitle, color: c.gray900, justifyContent: 'center' },
  '.rdp-weekday': { ...textStyle.label, color: c.gray500 },
  '.rdp-day_button': { ...textStyle.metaText, color: c.gray900 },
  // 단일 선택은 기본 스타일에 배경이 없어, 테두리를 없앤 만큼 파란 원 배경을 직접 입힌다.
  '.rdp-selected': { fontSize: 'inherit', fontWeight: 600 },
  '.rdp-selected .rdp-day_button': { background: c.primary, color: c.white },
  '.rdp-today:not(.rdp-selected):not(.rdp-outside) .rdp-day_button': { fontWeight: 700 },
  '.rdp-chevron': { fill: c.gray700 },
});
const PickerTime = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 10,
  paddingTop: 10,
  borderTop: `0.5px solid ${c.gray200}`,
});
const PickerDone = styled.button({
  marginLeft: 'auto',
  height: 36,
  padding: '0 14px',
  border: 0,
  borderRadius: 8,
  background: c.primary,
  color: c.white,
});

const LinkRoot = styled.div({ position: 'relative', display: 'flex' });
const LinkPopover = styled.div({
  position: 'absolute',
  zIndex: 30,
  top: 'calc(100% + 6px)',
  left: 0,
  width: 300,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 14,
  borderRadius: 10,
  background: c.white,
  border: `0.5px solid ${c.gray200}`,
  boxShadow: '0 12px 28px rgba(17, 24, 39, .18)',
});
const LinkField = styled.div({ display: 'flex', flexDirection: 'column', gap: 6 });
const LinkLabel = styled.label({ fontSize: 12, color: c.gray700 });
const LinkInputBox = styled.input({
  height: 36,
  border: `0.5px solid ${c.gray300}`,
  borderRadius: 8,
  padding: '0 12px',
  '&:focus': { outline: 'none', borderColor: c.primary },
  '&[aria-invalid=true]': { borderColor: c.red },
});
const LinkError = styled.p({ margin: 0, fontSize: 12, color: c.red });
const LinkActions = styled.div({ display: 'flex', justifyContent: 'flex-end', gap: 6 });
const LinkGhost = styled.button({
  height: 32,
  padding: '0 12px',
  border: `1px solid ${c.gray200}`,
  borderRadius: 8,
  background: c.white,
  color: c.gray900,
  '&:hover': { background: c.gray50 },
});
const LinkApply = styled.button({
  height: 32,
  padding: '0 14px',
  border: 0,
  borderRadius: 8,
  background: c.primary,
  color: c.white,
});
const Error = styled.p({ color: c.red, margin: 0, textAlign: 'center' });
const Message = styled.p({ color: c.gray700, margin: 0 });
// 업로드 직후에는 크롭된 썸네일을 같은 비율로 표시한다.
const PosterPreview = styled.img<{ cropped?: boolean }>(({ cropped }) => ({
  width: '100%',
  ...(cropped
    ? { aspectRatio: `${POSTER_THUMBNAIL_ASPECT}`, objectFit: 'cover' }
    : { maxHeight: 640, objectFit: 'contain' }),
  borderRadius: 14,
}));

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
  minHeight: 282,
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
  '&[aria-invalid=true]': { borderBottom: `2px solid ${c.red}` },
});
const Roles = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  width: 760,
  maxWidth: '100%',
});
const RoleLabel = styled.span({
  ...textStyle.mInfoText,
  color: c.gray700,
  width: 64,
  flexShrink: 0,
});
const RoleRow = styled.div({ display: 'flex', alignItems: 'center', gap: 8 });

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
  border: `0.5px solid ${c.gray300}`,
  borderRadius: 8,
  padding: '0 14px',
  '&:focus': { outline: 'none', borderColor: c.primary },
  '&[aria-invalid=true]': { borderColor: c.red },
});

/* ---------- 텍스트 에디터 ---------- */
const EditorBox = styled.div({
  border: '0.5px solid #e9ecef',
  borderRadius: 8,
  background: c.white,
  '&[aria-invalid=true]': { borderColor: c.red },
  // 툴팁이 박스 밖으로 나가도 잘리지 않게 overflow를 숨기지 않는다.
});
const MenuBar = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: 8,
  flexWrap: 'wrap',
});
const ToolGroup = styled('div', { shouldForwardProp: (prop) => prop !== 'borderless' })<{
  borderless?: boolean;
}>(({ borderless }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: borderless ? 6 : 2,
  padding: 2,
  border: borderless ? 0 : '1px solid #e9ecef',
  borderRadius: 4,
}));
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
// 드롭다운 클릭이 에디터의 선택 영역을 풀지 않게 포커스 이동을 막는다.
const ToolDrop = styled.div({ display: 'flex' });
const RangeTilde = styled.span({ color: c.gray500, flexShrink: 0 });
const TipWrap = styled.span({
  position: 'relative',
  display: 'inline-flex',
  '&::after': {
    content: 'attr(data-tip)',
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '4px 8px',
    borderRadius: 4,
    background: c.gray900,
    color: c.white,
    fontSize: 11,
    whiteSpace: 'nowrap',
    opacity: 0,
    pointerEvents: 'none',
    transition: 'opacity 0.12s',
    zIndex: 20,
  },
  '&:hover::after': { opacity: 1 },
});
const ScriptGlyph = styled.span({ fontSize: 13, fontWeight: 600, color: c.gray900 });
const PaletteRoot = styled.div({ position: 'relative', display: 'flex' });
const PaletteTrigger = styled.button({
  width: 28,
  height: 28,
  border: 0,
  borderRadius: 4,
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:hover, &[aria-expanded=true]': { background: c.gray100 },
});
const PaletteGrid = styled.div({
  position: 'absolute',
  zIndex: 30,
  top: 'calc(100% + 6px)',
  left: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 24px)',
  gap: 6,
  padding: 10,
  borderRadius: 10,
  background: c.white,
  border: `0.5px solid ${c.gray200}`,
  boxShadow: '0 12px 28px rgba(17, 24, 39, .18)',
});
const Swatch = styled('button', {
  shouldForwardProp: (prop) => prop !== 'selected' && prop !== 'none',
})<{ selected: boolean; none: boolean }>(({ selected, none }) => ({
  width: 24,
  height: 24,
  borderRadius: '50%',
  border: selected ? `2px solid ${c.primary}` : `1px solid ${c.gray300}`,
  // '없음'은 대각선으로 지운 칸으로 표시한다.
  backgroundImage: none
    ? `linear-gradient(135deg, transparent 45%, ${c.red} 45%, ${c.red} 55%, transparent 55%)`
    : undefined,
  backgroundColor: none ? c.white : undefined,
  cursor: 'pointer',
}));
const ColorMark = styled.span({
  fontSize: 13,
  fontWeight: 700,
  lineHeight: '16px',
  padding: '0 3px',
  color: c.gray900,
  borderBottom: '3px solid transparent',
});
const AttachHint = styled.span({ fontSize: 12, color: c.gray500 });
const AttachList = styled.ul({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  margin: 0,
  padding: 0,
  listStyle: 'none',
});
const AttachItem = styled.li({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: '8px 12px',
  border: `1px solid ${c.gray200}`,
  borderRadius: 8,
  fontSize: 14,
  '& button': { border: 0, background: 'none', color: c.red, cursor: 'pointer' },
});
const ToolIcon = styled.img({ width: 20, height: 20, objectFit: 'contain' });
const ContentsArea = styled.div({
  padding: '12px 16px 16px',
  outline: 'none',
  minHeight: 320,
  cursor: 'text',
  '& h1': { fontSize: 24, fontWeight: 700, lineHeight: 1.25 },
  '& p': { fontSize: 15, lineHeight: 1.6, marginTop: 10 },
  ...richContentStyles,
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
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  padding: '0 14px',
  '&:focus': { outline: 'none', borderColor: c.primary },
  '&[aria-invalid=true]': { borderColor: c.red },
});

/* ---------- 문의연락처 ---------- */
const ContactInput = styled.input({
  width: '100%',
  height: 40,
  border: `0.5px solid ${c.gray200}`,
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

/** datetime-local 입력용 로컬 시각(YYYY-MM-DDTHH:mm). */
function toDateTimeInput(value: string | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${toDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
