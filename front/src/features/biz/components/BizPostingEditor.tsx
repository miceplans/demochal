'use client';

import { useEffect, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { DayPicker } from 'react-day-picker';
import { ko } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { toDateKey } from '@/lib/date';
import { escapeHtml, normalizeLinkUrl } from './BizPostingFormPage.logic';

export const ICON = '/assets/icons';

// 상세정보는 정화된 HTML로 저장한다(서버가 저장 시 한 번 더 정화). 글자 크기·색·글꼴·정렬은 허용된 style 값으로만 저장된다.
// TODO: https://developer.mozilla.org/docs/Web/API/Document/execCommand
export const EDITOR_COMMANDS = {
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
export type EditorCommand = keyof typeof EDITOR_COMMANDS | 'image' | 'code';
// execCommand가 인라인 style(text-align 등)로 결과를 만들어야 하는 명령. 나머지는 b/i/u 같은 태그로 만든다.
export const STYLE_COMMANDS = new Set<string>([
  'justifyLeft',
  'justifyCenter',
  'justifyRight',
  'justifyFull',
]);

export type ParagraphStyle = 'p' | 'h2' | 'h3';
export const PARAGRAPH_STYLES: { value: ParagraphStyle; label: string }[] = [
  { value: 'p', label: '본문' },
  { value: 'h2', label: '제목' },
  { value: 'h3', label: '소제목' },
];
export const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48];
export const FONT_FAMILIES = [
  { value: '', label: '기본 글꼴' },
  { value: "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif", label: '고딕' },
  { value: "'Nanum Myeongjo', Batang, serif", label: '명조' },
  { value: "'Nanum Pen Script', cursive", label: '손글씨' },
  { value: "'Courier New', monospace", label: '고정폭' },
];

/** 호버(또는 키보드 포커스)하면 이름을 말풍선으로 보여준다. */
export function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return <TipWrap data-tip={label}>{children}</TipWrap>;
}

export function ToolBtn({
  label,
  icon,
  glyph,
  command,
  active = false,
  onRun,
}: {
  label: string;
  icon?: string;
  glyph?: React.ReactNode;
  command?: EditorCommand;
  /** 캐럿 위치에서 이 서식이 활성이면 눌림 상태로 표시한다. */
  active?: boolean;
  onRun: (command: EditorCommand) => void;
}) {
  return (
    <Tip label={label}>
      <ToolButton
        type="button"
        aria-label={label}
        aria-pressed={active}
        $active={active}
        disabled={!command}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => command && onRun(command)}
      >
        {icon ? <ToolIcon src={`${ICON}/${icon}`} alt="" /> : glyph}
      </ToolButton>
    </Tip>
  );
}

export function AlignGlyph({ kind }: { kind: 'left' | 'center' | 'right' | 'justify' }) {
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

export const keepEditorFocus = (event: React.MouseEvent) => event.preventDefault();

// 본문 글자에 칠하는 사용자 콘텐츠 색이라 디자인 토큰과 별개의 고정 팔레트를 쓴다.
export const TEXT_COLORS = [
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
export const HIGHLIGHT_COLORS = [
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
export function ColorPalette({
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
export function DatePickerField({
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

// 툴 버튼에 눌림 상태(aria-pressed)로 표시할 명령 키 — queryCommandState로 캐럿 위치의 서식을 받아온다.
export const STATEFUL_COMMAND_KEYS = [
  'bold',
  'italic',
  'underline',
  'strike',
  'superscript',
  'subscript',
  'alignLeft',
  'alignCenter',
  'alignRight',
  'alignJustify',
  'bullet',
  'number',
] as const;

export const sameCommandSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((key) => b.has(key));

/**
 * 링크 버튼 + 팝오버. 선택한 글자에 링크를 걸거나(선택이 없으면 표시 글자와 함께 삽입),
 * 커서가 링크 안이면 주소를 고치거나 해제한다. 입력창이 포커스를 가져가므로 기억해 둔 선택 영역을 복원해 적용한다.
 */
export function LinkTool({
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
const ToolButton = styled('button', { shouldForwardProp: (prop) => prop !== '$active' })<{
  $active?: boolean;
}>(({ $active }) => ({
  width: 28,
  height: 28,
  border: 0,
  borderRadius: 4,
  background: $active ? c.lightBlue : 'transparent',
  color: $active ? c.primary : 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:hover': { background: c.gray100 },
  // 눌림 상태는 유지한 채 호버 배경이 덮이지 않게 한다.
  '&[aria-pressed=true]:hover': { background: c.lightBlue },
}));
// 드롭다운 클릭이 에디터의 선택 영역을 풀지 않게 포커스 이동을 막는다.
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
const ToolIcon = styled.img({ width: 20, height: 20, objectFit: 'contain' });
