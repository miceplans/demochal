'use client';

import { useState } from 'react';
import styled from '@emotion/styled';
import { generated, type ApplicationFormAnswer } from '@semochal/api-client';
import { useToast } from '@/components/common/Toast';
import { fileAnswerIds } from '@/components/applications/ApplicationQuestions';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

const AttachmentButton = styled.button({
  border: 0,
  borderRadius: 6,
  background: c.paleBlue,
  color: c.primary,
  ...textStyle.overline,
  padding: '8px 12px',
  cursor: 'pointer',
  '&:hover:not(:disabled)': { background: c.gray50 },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
});
const AnswerTitle = styled.dt({ ...textStyle.subtitle, color: c.gray700 });

function Attachment({
  applicationId,
  fileId,
  label,
}: {
  applicationId: string;
  fileId: string;
  label: string;
}) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const openFile = async () => {
    setPending(true);
    try {
      const response = await generated.getApplicationAttachment(applicationId, fileId);
      if (response.status !== 200) throw new Error('File unavailable');
      window.location.assign(response.data.url);
    } catch {
      toast.error('첨부파일을 열지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setPending(false);
    }
  };
  return (
    <AttachmentButton type="button" disabled={pending} onClick={() => void openFile()}>
      {pending ? '불러오는 중…' : label}
    </AttachmentButton>
  );
}

/** 신청서 응답 목록(질문 제목 + 답변). 표의 펼침 영역과 응답 사이드 패널이 함께 쓴다. */
export function ApplicationAnswerList({
  applicationId,
  answers,
}: {
  applicationId: string;
  answers?: ApplicationFormAnswer[];
}) {
  if (!answers?.length) return <p>추가 질문에 대한 응답이 없습니다.</p>;
  return (
    <dl style={{ margin: 0 }}>
      {answers.map((answer) => (
        <div key={answer.questionId} style={{ marginTop: 16 }}>
          <AnswerTitle>{answer.title}</AnswerTitle>
          <dd style={{ margin: '8px 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {answer.type === 'file' && fileAnswerIds(answer.value).length > 0
              ? fileAnswerIds(answer.value).map((fileId, index, ids) => (
                  <div key={fileId}>
                    <Attachment
                      applicationId={applicationId}
                      fileId={fileId}
                      label={ids.length > 1 ? `첨부파일 ${index + 1} 열기` : '첨부파일 열기'}
                    />
                  </div>
                ))
              : (Array.isArray(answer.value) ? answer.value.join(', ') : answer.value) ||
                '답변 없음'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ApplicationAnswers({
  applicationId,
  answers,
}: {
  applicationId: string;
  answers?: ApplicationFormAnswer[];
}) {
  return (
    <details
      style={{
        padding: 16,
        background: c.gray50,
        ...textStyle.caption,
      }}
    >
      <summary style={{ cursor: 'pointer', color: c.gray700, ...textStyle.bodyStrong }}>
        신청서 응답 보기
      </summary>
      <ApplicationAnswerList applicationId={applicationId} answers={answers} />
    </details>
  );
}
