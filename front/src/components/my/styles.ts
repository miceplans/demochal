'use client';
import styled from '@emotion/styled';
import { Row } from '@/components/common/Primitives';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';

// 2개 이상의 MY 화면이 공유하는 styled만 둔다. 화면 전용 styled는 각 화면 파일 하단에 둔다.
export const EndRow = styled(Row)<{ $mt?: number }>(({ $mt }) => ({
  justifyContent: 'flex-end',
  marginTop: $mt,
}));

export const Table = styled.table({
  width: '100%',
  borderSpacing: 0,
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 12,
  ...textStyle.bodySmall,
  '& th': { background: c.gray100, textAlign: 'left', fontWeight: 500 },
  '& td, & th': { padding: '14px 16px', borderBottom: `0.5px solid ${c.gray100}` },
  '& th:first-child': { borderRadius: '11px 0 0 0' },
  '& th:last-child': { borderRadius: '0 11px 0 0' },
  '& tr:last-child td:first-child': { borderRadius: '0 0 0 11px' },
  '& tr:last-child td:last-child': { borderRadius: '0 0 11px 0' },
  '& tbody tr': { transition: 'background 0.12s ease' },
  '& tbody tr:hover': { background: c.gray50 },
  [mobile]: { '& td, & th': { padding: 10, fontSize: textStyle.mInfoText.fontSize } },
});

export const InlineRow = styled(Row)({ alignItems: 'center', flexWrap: 'nowrap' });
