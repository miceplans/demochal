'use client';

import { useRef, useState } from 'react';
import { Select } from '@/components/common/Primitives';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

export type Question = NonNullable<
  generated.UpdateChallengeMutationBody['applicationForm']
>[number];
export type Answers = Record<string, string | string[]>;

export function isAnswerValid(question: Question, value: string | string[] | undefined) {
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
  const upload = async (questionId: string, file: File) => {
    if (busy.current) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
    const contentType = allowed.find((type) => type === file.type);
    if (!contentType || file.size > 10 * 1024 * 1024 || file.size === 0) {
      setUploadError('PDF, JPG, PNG, WebP 파일을 10MB 이하로 선택해 주세요.');
      return;
    }
    busy.current = true;
    onUploading(true);
    setUploadError('');
    try {
      const response = await generated.requestPresignedUpload({
        bucket: 'private',
        contentType,
        fileName: file.name,
        sizeBytes: file.size,
      });
      if (response.status !== 201) throw new Error('Upload unavailable');
      const { uploadUrl, fileId } = response.data;
      // Presigned S3 PUT uses the existing private upload flow; API requests use the generated client.
      const uploaded = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });
      if (!uploaded.ok) throw new Error('Upload failed');
      const finalized = await generated.finalizeUpload(fileId);
      if (finalized.status !== 201) throw new Error('Upload verification failed');
      onChange(questionId, fileId);
    } catch {
      setUploadError('첨부파일을 업로드하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      busy.current = false;
      onUploading(false);
    }
  };
  return (
    <>
      {questions.map((question) => {
        const value = answers[question.id];
        const text = typeof value === 'string' ? value : '';
        const selected = Array.isArray(value) ? value : [];
        const inputId = `question-${question.id}`;
        return (
          <Field key={question.id} disabled={disabled}>
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
              <Select
                id={inputId}
                aria-label={question.title}
                required={question.required}
                value={text}
                onChange={(event) => onChange(question.id, event.target.value)}
              >
                <option value="">선택해 주세요</option>
                {question.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
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
                <input
                  type="file"
                  aria-label={question.title}
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void upload(question.id, file);
                  }}
                />
                <small>PDF, JPG, PNG, WebP · 최대 10MB</small>
                {text && (
                  <div>
                    첨부 완료{' '}
                    <button type="button" onClick={() => onChange(question.id, '')}>
                      첨부 삭제
                    </button>
                  </div>
                )}
              </>
            )}
          </Field>
        );
      })}
      {uploadError && <p role="alert">{uploadError}</p>}
    </>
  );
}

const Field = styled.fieldset({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minWidth: 0,
  margin: 0,
  padding: 20,
  border: `0.5px solid ${c.gray100}`,
  borderRadius: 12,
  color: c.gray900,
  ...textStyle.body,
  '& legend': { padding: '0 8px', ...textStyle.bodyStrong },
  '& input:not([type=radio]):not([type=checkbox]), & textarea, & select': {
    boxSizing: 'border-box',
    maxWidth: '100%',
    padding: 12,
    border: `0.5px solid ${c.gray300}`,
    borderRadius: 6,
    font: 'inherit',
    color: 'inherit',
    background: c.white,
  },
});
