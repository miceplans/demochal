'use client';

import { useRef, useState } from 'react';
import { Dropdown } from '@/components/ui/Dropdown';
import { FileUploader } from '@/components/ui/FileUploader';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c, shadows as s, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';

export type Question = NonNullable<
  generated.UpdateChallengeMutationBody['applicationForm']
>[number];
export type Answers = Record<string, string | string[]>;

export const MAX_FILE_ANSWERS = 10;

/** 파일 답변은 예전 초안에 UUID 문자열 하나로 남아 있을 수 있어 배열로 맞춘다. */
export function fileAnswerIds(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export function isAnswerValid(question: Question, value: string | string[] | undefined) {
  if (question.type === 'file') return !question.required || fileAnswerIds(value).length > 0;
  if (value === undefined) return !question.required;
  if (question.type === 'checkbox') {
    return (
      Array.isArray(value) &&
      (!question.required || value.length > 0) &&
      value.every((item) => question.options?.includes(item))
    );
  }
  if (typeof value !== 'string') return false;
  if (!value.trim()) return !question.required;
  if (question.type === 'radio' || question.type === 'dropdown')
    return Boolean(question.options?.includes(value));
  return value.length <= (question.type === 'long' ? 10000 : 500);
}

const isAnswered = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());

export function ApplicationQuestions({
  questions,
  answers,
  onChange,
  onUploading,
  disabled,
}: {
  questions: Question[];
  answers: Answers;
  onChange: (questionId: string, value: string | string[]) => void;
  onUploading: (busy: boolean) => void;
  disabled: boolean;
}) {
  const busy = useRef(false);
  const [uploadError, setUploadError] = useState('');
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const upload = async (questionId: string, picked: File[]) => {
    if (busy.current) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
    const current = fileAnswerIds(answers[questionId]);
    const room = MAX_FILE_ANSWERS - current.length;
    if (room <= 0) {
      setUploadError(`파일은 최대 ${MAX_FILE_ANSWERS}개까지 첨부할 수 있습니다.`);
      return;
    }
    const batch = picked.slice(0, room);
    const invalidFile = batch.some(
      (file) =>
        !allowed.some((type) => type === file.type) ||
        file.size > 10 * 1024 * 1024 ||
        file.size === 0,
    );
    if (invalidFile) {
      setUploadError('PDF, JPG, PNG, WebP 파일을 10MB 이하로 선택해 주세요.');
      return;
    }
    busy.current = true;
    onUploading(true);
    setUploadError(
      picked.length > room ? `파일은 최대 ${MAX_FILE_ANSWERS}개까지 첨부할 수 있습니다.` : '',
    );
    const uploaded: string[] = [];
    try {
      for (const file of batch) {
        const contentType = allowed.find((type) => type === file.type)!;
        const response = await generated.requestPresignedUpload({
          bucket: 'private',
          contentType,
          fileName: file.name,
          sizeBytes: file.size,
        });
        if (response.status !== 201) throw new Error('Upload unavailable');
        const { uploadUrl, fileId } = response.data;
        // Presigned S3 PUT uses the existing private upload flow; API requests use the generated client.
        const put = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: file,
        });
        if (!put.ok) throw new Error('Upload failed');
        const finalized = await generated.finalizeUpload(fileId);
        if (finalized.status !== 201) throw new Error('Upload verification failed');
        uploaded.push(fileId);
        setFileNames((names) => ({ ...names, [fileId]: file.name }));
      }
    } catch {
      setUploadError('첨부파일을 업로드하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      // 일부만 성공해도 검증이 끝난 파일은 답변에 남긴다.
      if (uploaded.length > 0) onChange(questionId, [...current, ...uploaded]);
      busy.current = false;
      onUploading(false);
    }
  };
  return (
    <Questions>
      {questions.map((question) => {
        const value = answers[question.id];
        const text = typeof value === 'string' ? value : '';
        const selected = Array.isArray(value) ? value : [];
        const inputId = `question-${question.id}`;
        return (
          <Field key={question.id} disabled={disabled} $completed={isAnswered(value)}>
            <legend>
              {question.title}
              {question.required ? ' (필수)' : ' (선택)'}
            </legend>
            {(question.type === 'short' || question.type === 'long') &&
              (question.type === 'long' ? (
                <textarea
                  id={inputId}
                  aria-label={question.title}
                  required={question.required}
                  maxLength={10000}
                  value={text}
                  onChange={(event) => onChange(question.id, event.target.value)}
                  rows={5}
                />
              ) : (
                <input
                  id={inputId}
                  aria-label={question.title}
                  required={question.required}
                  maxLength={500}
                  value={text}
                  onChange={(event) => onChange(question.id, event.target.value)}
                />
              ))}
            {question.type === 'dropdown' && (
              <Dropdown
                aria-label={question.title}
                placeholder="선택해 주세요"
                options={(question.options ?? []).map((option) => ({
                  value: option,
                  label: option,
                }))}
                value={text}
                onChange={(value) => onChange(question.id, value)}
              />
            )}
            {(question.type === 'radio' || question.type === 'checkbox') &&
              question.options?.map((option) => (
                <label key={option}>
                  <input
                    type={question.type}
                    name={inputId}
                    value={option}
                    checked={
                      question.type === 'checkbox' ? selected.includes(option) : text === option
                    }
                    required={question.type === 'radio' && question.required}
                    onChange={(event) =>
                      onChange(
                        question.id,
                        question.type === 'radio'
                          ? option
                          : event.target.checked
                            ? [...selected, option]
                            : selected.filter((item) => item !== option),
                      )
                    }
                  />{' '}
                  {option}
                </label>
              ))}
            {question.type === 'radio' && !question.required && (
              <button type="button" onClick={() => onChange(question.id, '')}>
                선택 해제
              </button>
            )}
            {question.type === 'file' && (
              <>
                <FileUploader
                  multiple
                  aria-label={question.title}
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onFiles={(picked) => void upload(question.id, picked)}
                />
                <small>PDF, JPG, PNG, WebP · 파일당 최대 10MB · 최대 {MAX_FILE_ANSWERS}개</small>
                {fileAnswerIds(value).length > 0 && (
                  <div>
                    첨부 완료
                    <ul>
                      {fileAnswerIds(value).map((fileId) => (
                        <li key={fileId}>
                          {fileNames[fileId] ?? '첨부파일'}{' '}
                          <button
                            type="button"
                            onClick={() =>
                              onChange(
                                question.id,
                                fileAnswerIds(value).filter((id) => id !== fileId),
                              )
                            }
                          >
                            첨부 삭제
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </Field>
        );
      })}
      {uploadError && <p role="alert">{uploadError}</p>}
    </Questions>
  );
}

const Questions = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 60,
  counterReset: 'question',
  [mobile]: { gap: 28 },
});
// 단계 번호는 CSS 카운터로 그려 legend 텍스트(접근성 이름)에 숫자가 섞이지 않게 한다.
const Field = styled.fieldset<{ $completed: boolean }>(({ $completed }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
  minWidth: 0,
  margin: 0,
  padding: 0,
  border: 0,
  color: c.gray900,
  counterIncrement: 'question',
  ...textStyle.body,
  '& legend': {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
    padding: 0,
    color: c.gray900,
    fontSize: 24,
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
    '&::before': {
      content: 'counter(question)',
      display: 'grid',
      width: 30,
      height: 30,
      placeItems: 'center',
      flexShrink: 0,
      boxSizing: 'border-box',
      border: `${$completed ? 0 : 0.5}px solid ${c.primary}`,
      borderRadius: '50%',
      background: $completed ? c.primary : c.white,
      color: $completed ? c.white : c.primary,
      fontSize: 20,
      fontWeight: 600,
    },
    [mobile]: {
      marginBottom: 14,
      fontSize: 17,
      letterSpacing: 0,
      '&::before': { width: 26, height: 26, fontSize: 14 },
    },
  },
  [mobile]: { gap: 14 },
  '& input:not([type=radio]):not([type=checkbox]):not([type=file]), & textarea': {
    width: 800,
    maxWidth: '100%',
    boxSizing: 'border-box',
    padding: '0 14px',
    border: `0.5px solid ${c.gray100}`,
    borderRadius: 8,
    font: 'inherit',
    color: 'inherit',
    background: c.white,
    '&:hover:not(:focus)': { borderColor: c.gray300 },
    '&:focus': { outline: 'none', boxShadow: s.focus },
  },
  '& input:not([type=radio]):not([type=checkbox]):not([type=file])': { height: 44 },
  '& textarea': { padding: 14, resize: 'vertical' },
  '& label': { display: 'flex', alignItems: 'center', gap: 8, color: c.gray700 },
  '& input[type=radio], & input[type=checkbox]': { accentColor: c.primary },
  '& small': { color: c.gray500 },
  '& button': {
    alignSelf: 'flex-start',
    padding: 0,
    border: 0,
    background: 'none',
    color: c.gray500,
    fontSize: 13,
    textDecoration: 'underline',
  },
  '& > div:not([role])': { display: 'flex', gap: 8, color: c.gray700 },
}));
