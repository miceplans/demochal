'use client';
import { useEffect, useId, useState } from 'react';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

const SEARCH_DEBOUNCE_MS = 250;
const SUGGESTION_LIMIT = 8;

interface Selected {
  id: string;
  title: string;
}

// 팀 탐색의 챌린지 필터: 드롭다운 대신 이름으로 검색해 하나를 고른다. 비어 있으면 전체 챌린지.
export function ChallengeSearch({
  value,
  onChange,
  fullWidth = false,
}: {
  value: string;
  onChange: (id: string) => void;
  fullWidth?: boolean;
}) {
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);
  const listId = useId();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const suggestions = generated.useListChallenges(
    { limit: SUGGESTION_LIMIT, q: debounced || undefined, includeClosed: true },
    { query: { enabled: open } },
  );
  const items = suggestions.data?.data.items ?? [];
  // 부모가 값을 비운 경우(필터 초기화 등) 표시용 선택 항목도 함께 비운다.
  const current = value && selected?.id === value ? selected : null;

  const pick = (item: Selected) => {
    setSelected(item);
    setText('');
    setDebounced('');
    setOpen(false);
    onChange(item.id);
  };
  const clear = () => {
    setSelected(null);
    onChange('');
  };

  return (
    <Root $full={fullWidth}>
      {current ? (
        <Chosen>
          <span>{current.title}</span>
          <button type="button" aria-label="챌린지 선택 해제" onClick={clear}>
            ×
          </button>
        </Chosen>
      ) : (
        <Input
          type="search"
          role="combobox"
          aria-label="챌린지 검색"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="전체 챌린지 (검색)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        />
      )}
      {open && !current ? (
        <List id={listId} role="listbox" aria-label="챌린지 검색 결과">
          {items.length === 0 ? (
            <Empty>{suggestions.isLoading ? '검색 중…' : '검색 결과가 없어요'}</Empty>
          ) : (
            items.map((item) => (
              <li
                key={item.id}
                role="option"
                aria-selected={false}
                // blur보다 먼저 선택되도록 mousedown에서 처리한다.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick({ id: item.id ?? '', title: item.title ?? '챌린지' });
                }}
              >
                {item.title}
              </li>
            ))
          )}
        </List>
      ) : null}
    </Root>
  );
}

const Root = styled.div<{ $full: boolean }>(({ $full }) => ({
  position: 'relative',
  width: $full ? '100%' : undefined,
  minWidth: 0,
}));
const Input = styled.input({
  boxSizing: 'border-box',
  width: '100%',
  height: 36,
  padding: '0 14px',
  background: c.white,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  ...textStyle.body,
  '&::placeholder': { color: c.gray500 },
  '&:focus-visible': { outline: `2px solid ${c.gray700}`, outlineOffset: -1 },
});
const Chosen = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  height: 36,
  padding: '0 14px',
  background: c.white,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  ...textStyle.body,
  '& > span': { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  '& > button': { border: 0, background: 'transparent', color: c.gray500, cursor: 'pointer' },
});
const List = styled.ul({
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  right: 0,
  zIndex: 30,
  margin: 0,
  padding: 0,
  maxHeight: 280,
  overflowY: 'auto',
  listStyle: 'none',
  background: c.white,
  borderRadius: 8,
  boxShadow: '0 4px 2px rgb(0 0 0 / 10%)',
  '& > li': {
    padding: '12px 16px',
    ...textStyle.caption,
    color: '#111',
    cursor: 'pointer',
  },
  '& > li:hover': { background: c.gray100 },
});
const Empty = styled.li({ color: c.gray500, cursor: 'default' });
