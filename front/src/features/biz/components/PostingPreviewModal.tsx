'use client';

import { useEffect } from 'react';
import styled from '@emotion/styled';
import { RichDescription } from '@/components/common/RichDescription';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

export type PostingPreview = {
  posterUrl: string | null;
  title: string;
  host: string;
  supervisor: string;
  sponsor: string;
  supporter: string;
  eligibility: string;
  category: string;
  topics: string[];
  startDate: string;
  endDate: string;
  eventStartDate: string;
  eventEndDate: string;
  summary: string;
  hashtags: string[];
  /** 정화된 상세정보 HTML. 비어 있으면 안내 문구를 보여준다. */
  descriptionHtml: string;
  attachments: { fileId: string; name: string }[];
  inquiryContact: string;
  externalUrl: string | null;
};

/** datetime-local(`YYYY-MM-DDTHH:mm`) 또는 date(`YYYY-MM-DD`) 값을 `YYYY.MM.DD HH:mm`으로 보여준다. */
const formatInput = (value: string) => value.replace('T', ' ').replaceAll('-', '.');
const period = (start: string, end: string) =>
  [start, end].filter(Boolean).map(formatInput).join(' ~ ');

/** 작성 중인 공고가 사용자 사이트 상세 페이지에서 어떻게 보일지 보여주는 미리보기(저장·게시 없음). */
export function PostingPreviewModal({
  data,
  onClose,
}: {
  data: PostingPreview;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const credits = [
    ['주최', data.host],
    ['주관', data.supervisor],
    ['협찬', data.sponsor],
    ['후원', data.supporter],
  ].filter(([, value]) => value);

  return (
    <Backdrop onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <Panel role="dialog" aria-modal="true" aria-label="공고 미리보기">
        <Bar>
          <strong>미리보기</strong>
          <Note>저장되지 않은 작성 내용입니다. 실제 공고 화면과 거의 같게 보여줍니다.</Note>
          <CloseButton type="button" aria-label="미리보기 닫기" onClick={onClose}>
            닫기
          </CloseButton>
        </Bar>
        <Scroll>
          <Intro>
            <Cover>
              {data.posterUrl ? (
                <img src={data.posterUrl} alt="포스터" />
              ) : (
                <span>{(data.title || '제목').slice(0, 1)}</span>
              )}
            </Cover>
            <div>
              <Title>{data.title || '제목을 입력해주세요'}</Title>
              <Muted>{credits.map(([label, value]) => `${label} ${value}`).join(' · ')}</Muted>
              <Facts>
                <dt>자격 / 대상</dt>
                <dd>{data.eligibility || '-'}</dd>
                <dt>접수 기간</dt>
                <dd>{period(data.startDate, data.endDate) || '-'}</dd>
                {(data.eventStartDate || data.eventEndDate) && (
                  <>
                    <dt>행사 기간</dt>
                    <dd>{period(data.eventStartDate, data.eventEndDate)}</dd>
                  </>
                )}
                {data.category && (
                  <>
                    <dt>분야</dt>
                    <dd>{data.category}</dd>
                  </>
                )}
                {data.topics.length > 0 && (
                  <>
                    <dt>주제</dt>
                    <dd>{data.topics.join(', ')}</dd>
                  </>
                )}
              </Facts>
            </div>
          </Intro>

          {data.summary && (
            <Section>
              <h3>소개</h3>
              <Muted style={{ whiteSpace: 'pre-line' }}>{data.summary}</Muted>
            </Section>
          )}
          {data.hashtags.length > 0 && (
            <Section>
              <h3>해시태그</h3>
              <Muted>{data.hashtags.join(' ')}</Muted>
            </Section>
          )}
          <Section>
            <h3>상세 안내</h3>
            {data.descriptionHtml ? (
              <RichDescription value={data.descriptionHtml} />
            ) : (
              <Muted>아직 입력한 상세정보가 없습니다.</Muted>
            )}
          </Section>
          {data.attachments.length > 0 && (
            <Section>
              <h3>첨부파일</h3>
              <ul>
                {data.attachments.map((file) => (
                  <li key={file.fileId}>{file.name}</li>
                ))}
              </ul>
            </Section>
          )}
          {data.inquiryContact && (
            <Section>
              <h3>문의 연락처</h3>
              <Muted>{data.inquiryContact}</Muted>
            </Section>
          )}
          <Apply as="span">{data.externalUrl ? '외부 링크로 신청하기' : '참가 신청하기'}</Apply>
        </Scroll>
      </Panel>
    </Backdrop>
  );
}

const Backdrop = styled.div({
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  background: 'rgba(17, 24, 39, 0.5)',
});
const Panel = styled.div({
  width: '100%',
  maxWidth: 860,
  maxHeight: '100%',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 16,
  background: c.white,
  overflow: 'hidden',
});
const Bar = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 20px',
  borderBottom: `0.5px solid ${c.gray200}`,
});
const Note = styled.span({ flex: 1, ...textStyle.caption, color: c.gray500 });
const CloseButton = styled.button({
  height: 32,
  padding: '0 14px',
  border: `1px solid ${c.gray200}`,
  borderRadius: 8,
  background: c.white,
  color: c.gray900,
  '&:hover': { background: c.gray50 },
});
const Scroll = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 28,
  padding: 24,
  overflowY: 'auto',
});
const Intro = styled.div({
  display: 'flex',
  gap: 24,
  flexWrap: 'wrap',
});
const Cover = styled.div({
  width: 315,
  maxWidth: '100%',
  borderRadius: 12,
  background: c.gray100,
  overflow: 'hidden',
  display: 'grid',
  placeItems: 'center',
  minHeight: 220,
  // 포스터는 자르지 않고 원본 비율 그대로 보여준다.
  img: { display: 'block', width: '100%', height: 'auto' },
  span: { fontSize: 56, fontWeight: 700, color: c.gray300 },
});
const Title = styled.h2({ margin: 0, fontSize: 24, fontWeight: 700, color: c.gray900 });
const Muted = styled.p({ margin: '6px 0 0', color: c.gray700, ...textStyle.bodySmall });
const Facts = styled.dl({
  display: 'grid',
  gridTemplateColumns: 'max-content 1fr',
  gap: '6px 16px',
  margin: '16px 0 0',
  ...textStyle.bodySmall,
  dt: { color: c.gray500 },
  dd: { margin: 0, color: c.gray900 },
});
const Section = styled.section({
  h3: { margin: '0 0 10px', fontSize: 15 },
  ul: { margin: 0, paddingLeft: 18 },
});
const Apply = styled.button({
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
  background: c.primary,
  color: c.white,
  ...textStyle.subtitle,
});
