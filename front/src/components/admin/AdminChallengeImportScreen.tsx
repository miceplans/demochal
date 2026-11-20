'use client';

import { useState } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { apiErrorMessage } from '@/lib/api-error';
import { useToast } from '@/components/common/Toast';
import { AdminPageTitle, ApproveButton, FieldLabel, RejectButton } from './parts';
import { useAdminHref } from './AdminShell';
import {
  IMPORT_CATEGORIES,
  IMPORT_ORGANIZER_TYPES,
  IMPORT_TARGETS,
  IMPORT_TEMPLATE,
  makePosterThumbnail,
  parseImportInput,
  type ParsedRow,
} from './AdminChallengeImportScreen.logic';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const POSTER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type RowState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; challengeId: string; businessName: string; businessCreated: boolean }
  | { kind: 'failed'; message: string };

const Body = styled.div({ display: 'flex', flexDirection: 'column', gap: 24 });
const Section = styled.section({ display: 'flex', flexDirection: 'column', gap: 12 });
const Caption = styled.p({ ...textStyle.caption, color: c.gray500, lineHeight: 1.6, margin: 0 });
const Code = styled.code({ ...textStyle.label2, background: c.gray50, padding: '1px 4px' });
const Textarea = styled.textarea({
  minHeight: 280,
  padding: 12,
  border: `1px solid ${c.gray200}`,
  borderRadius: 8,
  ...textStyle.label2,
  lineHeight: 1.5,
  resize: 'vertical',
  '&:focus': { outline: 'none', borderColor: c.primary },
});
const Actions = styled.div({ display: 'flex', gap: 8, flexWrap: 'wrap' });
const Table = styled.table({
  width: '100%',
  borderCollapse: 'collapse',
  ...textStyle.caption,
  'th, td': {
    borderBottom: `1px solid ${c.gray100}`,
    padding: '10px 8px',
    textAlign: 'left',
    verticalAlign: 'top',
  },
  th: { ...textStyle.overline, color: c.gray500 },
});
const MessageList = styled.ul({ margin: '6px 0 0', paddingLeft: 16 });
const ErrorText = styled.li({ color: c.red });
const WarnText = styled.li({ color: c.amber });
const DoneText = styled.span({ color: c.green });
const FailText = styled.span({ color: c.red });
const BackLink = styled(Link)({ ...textStyle.body, color: c.gray900, alignSelf: 'flex-start' });

/** 관리자 공모전·대외활동 일괄 등록 — 정해진 JSON 형식으로 붙여넣고 포스터를 골라 바로 게시한다. */
export function AdminChallengeImportScreen() {
  const hrefOf = useAdminHref();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [parseError, setParseError] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [posters, setPosters] = useState<Record<string, File>>({});
  const [states, setStates] = useState<Record<string, RowState>>({});
  const [running, setRunning] = useState(false);

  const requestUpload = generated.useRequestPresignedUpload();
  const finalizeUpload = generated.useFinalizeUpload();
  const importChallenge = generated.useImportAdminChallenge();

  const validate = () => {
    try {
      setRows(parseImportInput(input));
      setPosters({});
      setStates({});
      setParseError('');
    } catch (error) {
      setRows([]);
      setParseError((error as Error).message);
    }
  };

  const upload = async (file: File, purpose?: 'poster') => {
    const presigned = await requestUpload.mutateAsync({
      data: {
        bucket: 'public',
        contentType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
        fileName: file.name.replace(/[/\\]/g, '_').slice(0, 255),
        sizeBytes: file.size,
        ...(purpose && { purpose }),
      },
    });
    const response = await fetch(presigned.data.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!response.ok) throw new Error('이미지 업로드에 실패했어요.');
    await finalizeUpload.mutateAsync({ id: presigned.data.fileId });
    return presigned.data.fileId;
  };

  const registerRow = async (row: ParsedRow) => {
    setStates((current) => ({ ...current, [row.key]: { kind: 'running' } }));
    try {
      const poster = posters[row.key];
      let files = {};
      if (poster) {
        const thumbnail = await makePosterThumbnail(poster);
        const [posterFileId, thumbnailFileId] = await Promise.all([
          upload(poster, 'poster'),
          upload(thumbnail),
        ]);
        files = { posterFileId, thumbnailFileId };
      }
      const result = await importChallenge.mutateAsync({ data: { ...row.payload, ...files } });
      // 실패 응답(409 등)은 mutator가 예외로 던지므로 여기서는 201 본문만 남는다.
      if (result.status !== 201) throw new Error('등록에 실패했어요.');
      const { challenge, business } = result.data;
      setStates((current) => ({
        ...current,
        [row.key]: {
          kind: 'done',
          challengeId: challenge.id ?? '',
          businessName: business.name ?? row.payload.host,
          businessCreated: business.created,
        },
      }));
    } catch (error) {
      setStates((current) => ({
        ...current,
        [row.key]: { kind: 'failed', message: apiErrorMessage(error, '등록에 실패했어요.') },
      }));
    }
  };

  const registerAll = async () => {
    if (running) return;
    setRunning(true);
    // 같은 주최의 기업이 중복 생성되지 않도록(서버도 잠금으로 막는다) 순서대로 한 건씩 등록한다.
    for (const row of rows) {
      const state = states[row.key];
      if (row.errors.length || state?.kind === 'done') continue;
      await registerRow(row);
    }
    setRunning(false);
    void queryClient.invalidateQueries({ queryKey: generated.getListAdminContentsQueryKey() });
    toast.success('일괄 등록을 마쳤어요', '행별 결과를 확인해 주세요');
  };

  const pickPoster = (key: string, file: File | undefined) => {
    if (!file) return;
    if (!POSTER_TYPES.includes(file.type)) {
      toast.error('포스터는 JPG, PNG, WebP만 올릴 수 있어요');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('포스터는 10MB 이하만 올릴 수 있어요');
      return;
    }
    setPosters((current) => ({ ...current, [key]: file }));
  };

  const registrable = rows.filter(
    (row) => !row.errors.length && states[row.key]?.kind !== 'done',
  ).length;

  return (
    <Body>
      <BackLink href={hrefOf('/contents/challenges')}>← 이전</BackLink>
      <AdminPageTitle>공고 일괄 등록</AdminPageTitle>

      <Section>
        <FieldLabel>1. 공고 정보 붙여넣기 (JSON)</FieldLabel>
        <Caption>
          공고 하나는 객체, 여러 건은 배열로 넣어요. <Code>host</Code>(주최)와 이름이 같은 기업
          명의로 바로 게시되고, 같은 이름의 기업이 없으면 새로 만들어져요. 날짜는{' '}
          <Code>2026-12-31</Code> 또는 <Code>2026-12-31 18:00</Code>(한국 시간), 상금은 만원
          단위예요.
        </Caption>
        <Caption>
          category: {IMPORT_CATEGORIES.join(', ')}
          <br />
          targets: {IMPORT_TARGETS.join(', ')}
          <br />
          organizerType: {IMPORT_ORGANIZER_TYPES.join(', ')}
        </Caption>
        <Textarea
          aria-label="공고 정보 JSON"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={IMPORT_TEMPLATE}
          spellCheck={false}
        />
        <Actions>
          <RejectButton type="button" onClick={() => setInput(IMPORT_TEMPLATE)}>
            예시 넣기
          </RejectButton>
          <ApproveButton type="button" onClick={validate} disabled={!input.trim() || running}>
            검증하기
          </ApproveButton>
        </Actions>
        {parseError ? <FailText role="alert">{parseError}</FailText> : null}
      </Section>

      {rows.length ? (
        <Section>
          <FieldLabel>2. 포스터 선택 후 등록 ({rows.length}건)</FieldLabel>
          <Table>
            <thead>
              <tr>
                <th>공고</th>
                <th>주최(등록 명의)</th>
                <th>분류 · 마감</th>
                <th>포스터</th>
                <th>결과</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const state = states[row.key] ?? { kind: 'idle' };
                return (
                  <tr key={row.key}>
                    <td>
                      {row.payload.title || '(제목 없음)'}
                      {row.errors.length || row.warnings.length ? (
                        <MessageList>
                          {row.errors.map((message) => (
                            <ErrorText key={message}>{message}</ErrorText>
                          ))}
                          {row.warnings.map((message) => (
                            <WarnText key={message}>{message}</WarnText>
                          ))}
                        </MessageList>
                      ) : null}
                    </td>
                    <td>{row.payload.host}</td>
                    <td>
                      {row.payload.category ?? '-'}
                      <br />
                      {row.payload.endDate
                        ? new Date(row.payload.endDate).toLocaleString('ko-KR')
                        : '-'}
                    </td>
                    <td>
                      <input
                        type="file"
                        accept={POSTER_TYPES.join(',')}
                        aria-label={`${row.payload.title} 포스터`}
                        disabled={running || state.kind === 'done' || row.errors.length > 0}
                        onChange={(event) => pickPoster(row.key, event.target.files?.[0])}
                      />
                    </td>
                    <td>
                      {state.kind === 'running' ? '등록 중…' : null}
                      {state.kind === 'done' ? (
                        <DoneText>
                          게시됨 ·{' '}
                          <Link href={hrefOf(`/contents/challenges/${state.challengeId}`)}>
                            보기
                          </Link>
                          <br />
                          {state.businessName}
                          {state.businessCreated ? ' (기업 새로 생성)' : ''}
                        </DoneText>
                      ) : null}
                      {state.kind === 'failed' ? <FailText>{state.message}</FailText> : null}
                      {state.kind === 'idle' ? (row.errors.length ? '입력 오류' : '대기') : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Actions>
            <ApproveButton
              type="button"
              onClick={() => void registerAll()}
              disabled={running || registrable === 0}
            >
              {running ? '등록 중…' : `${registrable}건 등록하기`}
            </ApproveButton>
          </Actions>
        </Section>
      ) : null}
    </Body>
  );
}
