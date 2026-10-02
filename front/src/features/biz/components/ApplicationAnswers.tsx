'use client';

import { useState } from 'react';
import { generated, type ApplicationFormAnswer } from '@semochal/api-client';
import { useToast } from '@/components/common/Toast';

function Attachment({ applicationId, fileId }: { applicationId: string; fileId: string }) {
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
    <button type="button" disabled={pending} onClick={() => void openFile()}>
      {pending ? '불러오는 중…' : '첨부파일 열기'}
    </button>
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
    <details style={{ padding: 16 }}>
      <summary>신청서 응답 보기</summary>
      {!answers?.length ? (
        <p>추가 질문에 대한 응답이 없습니다.</p>
      ) : (
        <dl>
          {answers.map((answer) => (
            <div key={answer.questionId} style={{ marginTop: 16 }}>
              <dt>{answer.title}</dt>
              <dd style={{ margin: '8px 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {answer.type === 'file' && typeof answer.value === 'string' && answer.value ? (
                  <Attachment applicationId={applicationId} fileId={answer.value} />
                ) : (
                  (Array.isArray(answer.value) ? answer.value.join(', ') : answer.value) ||
                  '답변 없음'
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </details>
  );
}
