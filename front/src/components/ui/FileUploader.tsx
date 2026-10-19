'use client';

import type { ChangeEvent } from 'react';
import styled from '@emotion/styled';
import { Icon } from '@/components/common/Primitives';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

// 파일 업로드 공통 박스(피그마 1501:8573). 선택한 파일은 onFiles로 넘기고 input 값은 비워 같은 파일도 다시 고를 수 있다.
export function FileUploader({
  label = '파일을 업로드해 주세요',
  accept,
  multiple,
  disabled,
  required,
  'aria-label': ariaLabel,
  onFiles,
}: {
  label?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string;
  onFiles: (files: File[]) => void;
}) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length > 0) onFiles(files);
  };
  return (
    <Box disabled={disabled}>
      <Icon src="/assets/icons/upload-folder.svg" width={26} height={19} />
      {label}
      <HiddenInput
        type="file"
        aria-label={ariaLabel}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        required={required}
        onChange={handleChange}
      />
    </Box>
  );
}

const Box = styled.label<{ disabled?: boolean }>(({ disabled }) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '16px 10px',
  border: `1px dashed ${c.gray200}`,
  borderRadius: 8,
  color: c.gray900,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  ...textStyle.body,
  '&:hover': disabled ? undefined : { borderColor: c.primary },
  '&:focus-within': { borderColor: c.primary },
}));

const HiddenInput = styled.input({
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
});
