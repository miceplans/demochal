'use client';

import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';

// 목록·상품 화면이 공유하는 헤더 행.
const HeaderRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
});

// 결제 팝업과 광고명 모달이 공유하는 액션 버튼.
const PopupAction = styled('button', { shouldForwardProp: (prop) => prop !== 'secondary' })<{
  secondary?: boolean;
}>(({ secondary }) => ({
  height: 37,
  border: secondary ? `0.5px solid ${c.gray200}` : 0,
  borderRadius: 6,
  background: secondary ? c.white : c.primary,
  color: secondary ? c.gray900 : c.white,
  cursor: 'pointer',
  fontSize: secondary ? 12 : 13,
  fontWeight: 600,
  lineHeight: secondary ? 'normal' : 1.4,
  '&:disabled': { opacity: 0.4, cursor: 'not-allowed' },
}));

export { HeaderRow, PopupAction };
