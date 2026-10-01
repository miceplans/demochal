'use client';
import { useState, type ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { PrimaryButton, FieldInput, useBizHref } from '@/components/biz/BizShell';
import { Icon, Toggle } from '@/components/common/Primitives';

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { useToast } from '@/components/common/Toast';

type QuestionType = 'dropdown' | 'checkbox' | 'radio' | 'file' | 'short' | 'long';
type Question = {
  id: string;
  title: string;
  type: QuestionType;
  options: string[];
  required: boolean;
};

const QUESTION_TYPES: DropdownOption[] = [
  { value: 'dropdown', label: '드롭다운' },
  { value: 'checkbox', label: '체크박스' },
  { value: 'radio', label: '객관식 질문' },
  { value: 'file', label: '파일 업로드' },
  { value: 'short', label: '단문형 질문' },
  { value: 'long', label: '장문형 질문' },
];
const isChoiceType = (type: QuestionType) =>
  type === 'dropdown' || type === 'checkbox' || type === 'radio';

const Page = styled.div({
  width: '100%',
  maxWidth: 1200,
  display: 'flex',
  gap: 24,
  alignItems: 'flex-start',
});
const Main = styled.div({
  flex: '1 0 0',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
});
const TopBar = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 24,
});
const TitleCol = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 0,
  flex: 1,
});
const TitleInput = styled.input({
  border: 0,
  outline: 'none',
  width: '100%',
  fontSize: 40,
  fontWeight: 600,
  color: c.gray900,
  '&::placeholder': { color: c.gray300 },
});
const MetaInput = styled.input({
  border: 0,
  outline: 'none',
  width: '100%',
  ...textStyle.finePrint,
  color: c.gray500,
});

const QuestionBlock = styled.div({
  position: 'relative',
  display: 'flex',
  gap: 8,
  paddingLeft: 32,
});
const DeleteQuestionButton = styled.button({
  position: 'absolute',
  left: 0,
  top: 4,
  border: 0,
  background: 'none',
  padding: 0,
  color: c.gray300,
  '&:hover:not(:disabled)': { color: c.red },
  '&:disabled': { opacity: 0.3, cursor: 'not-allowed' },
});
const QuestionCard = styled.div({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
});
const QuestionHeader = styled.div({ display: 'flex', alignItems: 'center', gap: 12 });
const NumberBadge = styled.span<{ active?: boolean }>(({ active }) => ({
  flexShrink: 0,
  width: 30,
  height: 30,
  borderRadius: '50%',
  border: `2px solid ${c.primary}`,
  background: active ? c.primary : c.white,
  color: active ? c.white : c.primary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
  fontSize: 20,
}));
const QuestionTitleInput = styled.input({
  flex: 1,
  minWidth: 0,
  border: 0,
  outline: 'none',
  fontSize: 24,
  fontWeight: 600,
  color: c.gray500,
  '&::placeholder': { color: c.gray500 },
});

const OptionsList = styled.div({ display: 'flex', flexDirection: 'column', gap: 8 });
const OptionRow = styled.div({ display: 'flex', alignItems: 'center', gap: 10 });
const DragHandle = styled.span({
  color: c.gray300,
  flexShrink: 0,
  letterSpacing: -2,
  fontSize: 14,
});
const AddOptionButton = styled.button({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  alignSelf: 'flex-start',
  border: 0,
  background: 'none',
  padding: '4px 0',
  color: c.primary,
  ...textStyle.overline,
});

const PreviewInput = styled.input({
  height: 40,
  border: `1px solid ${c.gray100}`,
  borderRadius: 8,
  padding: '0 14px',
  background: c.gray50,
  color: c.gray500,
});
const PreviewTextarea = styled.textarea({
  minHeight: 72,
  border: `1px solid ${c.gray100}`,
  borderRadius: 8,
  padding: 14,
  background: c.gray50,
  color: c.gray500,
  resize: 'vertical',
});
const PreviewUpload = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 56,
  border: `1px dashed ${c.gray200}`,
  borderRadius: 8,
  color: c.gray500,
  ...textStyle.finePrint,
});

const RequiredRow = styled.label({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
});

const Toolbar = styled.aside({
  position: 'sticky',
  top: 100,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  borderRadius: 16,
  background: c.white,
  boxShadow: '0 4px 20px rgba(16,16,16,0.08)',
});
const ToolButton = styled.button({
  width: 40,
  height: 40,
  border: 0,
  borderRadius: 10,
  background: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: c.gray700,
  ...textStyle.overline,
  '&:hover:not(:disabled)': { background: c.gray50 },
  '&:disabled': { opacity: 0.35, cursor: 'not-allowed' },
});

const blankQuestion = (type: QuestionType = 'radio'): Question => ({
  // 저장된 질문 id(q-N)와 충돌하지 않도록 전역 유일 id를 쓴다(리뷰 #264-2).
  id: crypto.randomUUID(),
  title: '',
  type,
  options: isChoiceType(type) ? ['', ''] : [],
  required: false,
});

const Message = styled.p({ ...textStyle.finePrint, color: c.gray500 });

function formatPeriod(startDate?: string, endDate?: string) {
  const format = (value: string) => {
    const date = new Date(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
  };
  if (!startDate || !endDate) return '';
  return `${format(startDate)} ~ ${format(endDate)}`;
}

export function BizApplicationFormPage() {
  const { id } = useParams<{ id: string }>();
  const challengeQuery = generated.useGetMyChallenge(id, { query: { enabled: Boolean(id) } });
  const challenge = challengeQuery.data?.status === 200 ? challengeQuery.data.data : undefined;

  if (challengeQuery.isPending) {
    return <Message>공고 정보를 불러오는 중입니다.</Message>;
  }
  if (!challenge) {
    return (
      <Message>
        공고를 불러오지 못했습니다.{' '}
        <button type="button" onClick={() => void challengeQuery.refetch()}>
          다시 시도
        </button>
      </Message>
    );
  }

  // 공고 id가 바뀌면 편집 state를 초기화하기 위해 key로 에디터를 리셋한다(리뷰 #264-3).
  return <ApplicationFormEditor key={id} id={id} challenge={challenge} />;
}

type ChallengeDetail = Extract<
  Awaited<ReturnType<typeof generated.getMyChallenge>>,
  { status: 200 }
>['data'];

function ApplicationFormEditor({ id, challenge }: { id: string; challenge: ChallengeDetail }) {
  const router = useRouter();
  const hrefOf = useBizHref();
  const toast = useToast();
  const queryClient = useQueryClient();
  const updateChallenge = generated.useUpdateChallenge();

  // 신청서 제목/안내문구는 서버에 저장할 필드가 없어(리뷰 #264-4) 공고 정보에서만
  // 파생해 읽기 전용으로 보여준다. 편집할 수 없게 onChange 없이 readOnly로 렌더링한다.
  const title = challenge.title ? `${challenge.title} 신청서` : '신청서';
  const meta = `접수 ${formatPeriod(challenge.startDate, challenge.endDate)}`.trim();
  const [questions, setQuestions] = useState<Question[]>(() =>
    challenge.applicationForm && challenge.applicationForm.length > 0
      ? challenge.applicationForm.map((q) => ({
          id: q.id,
          title: q.title,
          type: q.type,
          options: q.options ?? [],
          required: q.required,
        }))
      : [blankQuestion()],
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  const addQuestion = (type: QuestionType) => {
    setQuestions((qs) => [...qs, blankQuestion(type)]);
  };
  const removeQuestion = (id: string) => {
    setQuestions((qs) => (qs.length > 1 ? qs.filter((q) => q.id !== id) : qs));
  };
  const updateQuestion = (id: string, patch: Partial<Question>) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };
  const changeType = (id: string, type: QuestionType) => {
    setQuestions((qs) =>
      qs.map((q) =>
        q.id === id
          ? {
              ...q,
              type,
              options: isChoiceType(type) ? (q.options.length ? q.options : ['', '']) : q.options,
            }
          : q,
      ),
    );
  };
  const changeOption = (id: string, index: number) => (e: ChangeEvent<HTMLInputElement>) => {
    setQuestions((qs) =>
      qs.map((q) =>
        q.id === id
          ? { ...q, options: q.options.map((o, i) => (i === index ? e.target.value : o)) }
          : q,
      ),
    );
  };
  const addOption = (id: string) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, options: [...q.options, ''] } : q)));
  };
  const removeOption = (id: string, index: number) => {
    setQuestions((qs) =>
      qs.map((q) => (q.id === id ? { ...q, options: q.options.filter((_, i) => i !== index) } : q)),
    );
  };

  const handlePublish = async () => {
    if (questions.some((q) => !q.title.trim())) {
      toast.error('모든 질문의 내용을 입력해주세요');
      return;
    }
    // 선택형 질문은 빈 옵션으로 게시할 수 없다(리뷰 #264-5).
    const emptyChoice = questions.find(
      (q) => isChoiceType(q.type) && q.options.some((option) => !option.trim()),
    );
    if (emptyChoice) {
      toast.error('선택형 질문의 모든 옵션을 입력해주세요');
      return;
    }
    try {
      await updateChallenge.mutateAsync({ id, data: { applicationForm: questions } });
    } catch {
      // 전역 MutationCache(providers.tsx)가 실패 토스트를 띄운다.
      return;
    }
    await queryClient.invalidateQueries({ queryKey: generated.getGetMyChallengeQueryKey(id) });
    toast.success('신청서가 게시되었습니다');
    router.push(hrefOf(`/postings/${id}`));
  };

  return (
    <Page>
      <Main>
        <TopBar>
          <TitleCol>
            <TitleInput value={title} readOnly aria-label="신청서 제목" />
            <MetaInput value={meta} readOnly aria-label="신청서 안내문구" />
          </TitleCol>
          <PrimaryButton
            style={{ height: 37, flexShrink: 0 }}
            onClick={() => void handlePublish()}
            disabled={updateChallenge.isPending}
          >
            {updateChallenge.isPending ? '게시 중…' : '신청서 게시'}
          </PrimaryButton>
        </TopBar>

        {questions.map((q, qi) => (
          <QuestionBlock key={q.id}>
            <DeleteQuestionButton
              type="button"
              disabled={questions.length <= 1}
              onClick={() => removeQuestion(q.id)}
              aria-label={`질문 ${qi + 1} 삭제`}
            >
              <XIcon size={20} />
            </DeleteQuestionButton>
            <QuestionCard>
              <QuestionHeader>
                <NumberBadge aria-hidden active={q.id === activeId}>
                  {qi + 1}
                </NumberBadge>
                <QuestionTitleInput
                  value={q.title}
                  onFocus={() => setActiveId(q.id)}
                  onChange={(e) => updateQuestion(q.id, { title: e.target.value })}
                  placeholder="질문을 작성해주세요."
                  aria-label={`질문 ${qi + 1} 내용`}
                />
                <Dropdown
                  options={QUESTION_TYPES}
                  value={q.type}
                  width={181}
                  aria-label={`질문 ${qi + 1} 유형`}
                  onChange={(value) => changeType(q.id, value as QuestionType)}
                />
              </QuestionHeader>

              {isChoiceType(q.type) && (
                <OptionsList>
                  {q.options.map((opt, oi) => (
                    <OptionRow key={oi}>
                      <DragHandle aria-hidden>⋮⋮</DragHandle>
                      <FieldInput
                        style={{ flex: 1 }}
                        value={opt}
                        onChange={changeOption(q.id, oi)}
                        placeholder="옵션을 입력해주세요"
                        aria-label={`질문 ${qi + 1} 옵션 ${oi + 1}`}
                      />
                      <DeleteQuestionButton
                        type="button"
                        style={{ position: 'static' }}
                        disabled={q.options.length <= 1}
                        onClick={() => removeOption(q.id, oi)}
                        aria-label={`옵션 ${oi + 1} 삭제`}
                      >
                        <XIcon size={16} />
                      </DeleteQuestionButton>
                    </OptionRow>
                  ))}
                  <AddOptionButton type="button" onClick={() => addOption(q.id)}>
                    <Icon name="imgAddSlotIc" size={16} alt="" />
                    옵션 추가
                  </AddOptionButton>
                </OptionsList>
              )}
              {q.type === 'short' && (
                <PreviewInput disabled placeholder="단답형 텍스트" aria-hidden />
              )}
              {q.type === 'long' && (
                <PreviewTextarea disabled placeholder="장문형 텍스트" aria-hidden />
              )}
              {q.type === 'file' && <PreviewUpload aria-hidden>파일 업로드 필드</PreviewUpload>}

              <RequiredRow>
                <Toggle
                  label={`질문 ${qi + 1} 필수 여부`}
                  checked={q.required}
                  onChange={() => updateQuestion(q.id, { required: !q.required })}
                />
                <span style={textStyle.overline}>필수 질문</span>
              </RequiredRow>
            </QuestionCard>
          </QuestionBlock>
        ))}
      </Main>

      <Toolbar aria-label="질문 추가 도구">
        <ToolButton type="button" title="질문 추가" onClick={() => addQuestion('radio')}>
          <Icon src="/assets/icons/add.svg" size={20} alt="질문 추가" />
        </ToolButton>
        <ToolButton type="button" title="링크 필드 추가" onClick={() => addQuestion('short')}>
          <Icon src="/assets/icons/toolbar-link.svg" size={20} alt="링크 필드 추가" />
        </ToolButton>
        <ToolButton type="button" title="AI로 질문 만들기 (준비 중)" disabled>
          AI
        </ToolButton>
        <ToolButton type="button" title="파일 업로드 질문 추가" onClick={() => addQuestion('file')}>
          <Icon src="/assets/icons/toolbar-file.svg" size={20} alt="파일 업로드 질문 추가" />
        </ToolButton>
        <ToolButton type="button" title="설명 텍스트 추가" onClick={() => addQuestion('long')}>
          <Icon src="/assets/icons/toolbar-layout.svg" size={20} alt="설명 텍스트 추가" />
        </ToolButton>
        <ToolButton type="button" title="이미지 첨부 질문 추가" onClick={() => addQuestion('file')}>
          <Icon src="/assets/icons/toolbar-image.svg" size={20} alt="이미지 첨부 질문 추가" />
        </ToolButton>
      </Toolbar>
    </Page>
  );
}
