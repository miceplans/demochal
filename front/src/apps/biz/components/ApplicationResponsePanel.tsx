'use client';

import { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import type { Application } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { ApplicationAnswerList } from './ApplicationAnswers';
import { GhostButton, EVALUATION_LABEL, STATUS_LABEL } from './ApplicationTable';

/** 선택한 신청서의 응답을 오른쪽 사이드 패널로 보여주고, 전체화면으로 넓혀 볼 수 있다. */
export function ApplicationResponsePanel({
  application,
  onClose,
}: {
  application: Application;
  onClose: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (fullscreen) setFullscreen(false);
      else onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [fullscreen, onClose]);

  const team = application.teammates.join(', ') || application.role || '—';
  return (
    <Panel
      role="complementary"
      aria-label="신청서 응답"
      data-fullscreen={fullscreen ? 'true' : undefined}
      fullscreen={fullscreen}
    >
      <Header>
        <div style={{ minWidth: 0 }}>
          <Title>{team}</Title>
          <Meta>신청자 {application.userId.slice(0, 8)}</Meta>
        </div>
        <Actions>
          <GhostButton type="button" onClick={() => setFullscreen((value) => !value)}>
            {fullscreen ? '전체화면 닫기' : '전체화면'}
          </GhostButton>
          <GhostButton type="button" aria-label="신청서 응답 닫기" onClick={onClose}>
            닫기
          </GhostButton>
        </Actions>
      </Header>
      <Body>
        <Summary>
          <Chip>신청 상태 · {STATUS_LABEL[application.status]}</Chip>
          <Chip>평가 · {EVALUATION_LABEL[application.evaluation]}</Chip>
          <Chip>제출일 · {application.createdAt.slice(0, 10).replaceAll('-', '.')}</Chip>
        </Summary>
        {application.managerMemo && <Memo>담당자 메모: {application.managerMemo}</Memo>}
        <ApplicationAnswerList applicationId={application.id} answers={application.formAnswers} />
      </Body>
    </Panel>
  );
}

const Panel = styled('aside', { shouldForwardProp: (prop) => prop !== 'fullscreen' })<{
  fullscreen: boolean;
}>(({ fullscreen }) => ({
  position: 'fixed',
  top: fullscreen ? 0 : 0,
  right: 0,
  bottom: 0,
  left: fullscreen ? 0 : 'auto',
  width: fullscreen ? 'auto' : 'min(480px, 100vw)',
  zIndex: 40,
  display: 'flex',
  flexDirection: 'column',
  background: c.white,
  boxShadow: fullscreen ? 'none' : '-8px 0 24px rgba(0, 0, 0, 0.08)',
}));
const Header = styled.header({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  padding: '20px 24px',
  background: c.gray50,
});
const Title = styled.h2({
  margin: 0,
  ...textStyle.h1_2,
  color: c.gray900,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const Meta = styled.span({ ...textStyle.metaText, color: c.gray500 });
const Actions = styled.div({ display: 'flex', gap: 8, flexShrink: 0 });
const Body = styled.div({
  flex: 1,
  overflowY: 'auto',
  padding: 24,
  ...textStyle.caption,
  '& > *': { maxWidth: 800 },
});
const Summary = styled.div({ display: 'flex', flexWrap: 'wrap', gap: 8 });
const Chip = styled.span({
  padding: '6px 10px',
  borderRadius: 999,
  background: c.gray50,
  color: c.gray700,
  ...textStyle.overline,
});
const Memo = styled.p({
  margin: '16px 0 0',
  padding: 12,
  borderRadius: 8,
  background: c.gray50,
  color: c.gray700,
});
