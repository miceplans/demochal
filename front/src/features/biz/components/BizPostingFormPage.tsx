'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { useToast } from '@/components/common/Toast';
import { adApi, adError } from '@/lib/ad-api';
import {
  BizContent,
  Field,
  FieldInput,
  FieldSelect,
  PrimaryButton,
  OutlineButton,
  useBizHref,
} from '@/components/biz/BizShell';
import { colors as c } from '@/styles/design';

const categories = ['IT/SW', '디자인', '창업/취업', '기획', '광고/마케팅', '대회', '해외'];

export function BizPostingFormPage() {
  const router = useRouter();
  const hrefOf = useBizHref();
  const [businessId, setBusinessId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    adApi.businesses
      .me()
      .then((business) => active && setBusinessId(business.id))
      .catch((cause) => active && setLoadError(adError(cause)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <PostingForm
      heading="공고 만들기"
      intro="공고 정보를 입력하면 비즈니스 계정으로 등록됩니다."
      initial={EMPTY_POSTING}
      submitLabel={loading ? '계정 확인 중…' : '공고 등록'}
      submittingLabel="등록 중…"
      disabled={loading || !businessId}
      initialError={loadError}
      onSubmit={async (values) => {
        const challenge = await adApi.challenges.create({ businessId, ...values });
        router.push(hrefOf(`/postings/${challenge.id}`));
      }}
    />
  );
}

export function BizPostingEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hrefOf = useBizHref();
  const toast = useToast();
  const queryClient = useQueryClient();
  const challengeQuery = generated.useGetChallenge(id, { query: { enabled: Boolean(id) } });
  const updateChallenge = generated.useUpdateChallenge();
  const challenge = challengeQuery.data?.status === 200 ? challengeQuery.data.data : undefined;

  if (challengeQuery.isPending)
    return (
      <BizContent>
        <Message>공고 정보를 불러오는 중입니다.</Message>
      </BizContent>
    );
  if (!challenge)
    return (
      <BizContent>
        <Message>
          공고를 불러오지 못했습니다.{' '}
          <button type="button" onClick={() => void challengeQuery.refetch()}>
            다시 시도
          </button>
        </Message>
      </BizContent>
    );

  return (
    <PostingForm
      heading="공고 수정"
      intro="수정한 내용은 저장 즉시 공고에 반영됩니다."
      initial={{
        title: challenge.title ?? '',
        description: challenge.description ?? '',
        price: String(challenge.price ?? 0),
        capacity: String(challenge.capacity ?? 1),
        startDate: toDateInput(challenge.startDate),
        endDate: toDateInput(challenge.endDate),
        category: challenge.category ?? '',
      }}
      submitLabel="수정 저장"
      submittingLabel="저장 중…"
      onSubmit={async (values) => {
        await updateChallenge.mutateAsync({ id, data: values });
        await queryClient.invalidateQueries({ queryKey: generated.getGetChallengeQueryKey(id) });
        toast.success('공고를 수정했습니다');
        router.push(hrefOf(`/postings/${id}`));
      }}
    />
  );
}

type PostingInput = {
  title: string;
  description: string;
  price: string;
  capacity: string;
  startDate: string;
  endDate: string;
  category: string;
};
type PostingValues = {
  title: string;
  description: string;
  price: number;
  capacity: number;
  startDate: string;
  endDate: string;
  category: string | null;
};

const EMPTY_POSTING: PostingInput = {
  title: '',
  description: '',
  price: '0',
  capacity: '1',
  startDate: '',
  endDate: '',
  category: '',
};

function PostingForm({
  heading,
  intro,
  initial,
  submitLabel,
  submittingLabel,
  disabled = false,
  initialError = '',
  onSubmit,
}: {
  heading: string;
  intro: string;
  initial: PostingInput;
  submitLabel: string;
  submittingLabel: string;
  disabled?: boolean;
  initialError?: string;
  onSubmit: (values: PostingValues) => Promise<void>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [price, setPrice] = useState(initial.price);
  const [capacity, setCapacity] = useState(initial.capacity);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [category, setCategory] = useState(initial.category);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const shownError = error || initialError;
  // 저장된 카테고리가 선택지에 없으면(과거 값 등) 사라지지 않도록 옵션에 포함한다.
  const categoryOptions =
    initial.category && !categories.includes(initial.category)
      ? [initial.category, ...categories]
      : categories;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const parsedPrice = Number(price);
    const parsedCapacity = Number(capacity);
    if (!title.trim() || !description.trim() || !startDate || !endDate)
      return setError('제목, 설명, 모집 기간을 입력해 주세요.');
    if (!Number.isInteger(parsedPrice) || parsedPrice < 0)
      return setError('참가비는 0 이상의 정수로 입력해 주세요.');
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1)
      return setError('모집 인원은 1명 이상으로 입력해 주세요.');
    if (endDate < startDate) return setError('종료일은 시작일 이후여야 합니다.');
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        price: parsedPrice,
        capacity: parsedCapacity,
        startDate: toLocalBoundary(startDate, false),
        endDate: toLocalBoundary(endDate, true),
        category: category || null,
      });
    } catch (cause) {
      setError(adError(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BizContent>
      <Header>
        <h1>{heading}</h1>
        <p>{intro}</p>
      </Header>
      <Form onSubmit={submit}>
        <Field>
          제목
          <FieldInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
          />
        </Field>
        <Field>
          상세 설명
          <Description
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={20000}
            required
          />
        </Field>
        <Grid>
          <Field>
            참가비(원)
            <FieldInput
              type="number"
              min={0}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
          <Field>
            모집 인원
            <FieldInput
              type="number"
              min={1}
              step={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </Field>
          <Field>
            시작일
            <FieldInput
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </Field>
          <Field>
            종료일
            <FieldInput
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </Field>
        </Grid>
        <Field>
          카테고리
          <FieldSelect value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">선택 안 함</option>
            {categoryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FieldSelect>
        </Field>
        {shownError && <Error role="alert">{shownError}</Error>}
        <Actions>
          <OutlineButton type="button" onClick={() => router.back()}>
            취소
          </OutlineButton>
          <PrimaryButton type="submit" disabled={disabled || submitting}>
            {submitting ? submittingLabel : submitLabel}
          </PrimaryButton>
        </Actions>
      </Form>
    </BizContent>
  );
}

const Header = styled.div({
  marginBottom: 28,
  '& h1': { margin: 0, fontSize: 28 },
  '& p': { color: c.gray700, margin: '8px 0 0' },
});
const Form = styled.form({ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 22 });
const Description = styled.textarea({
  minHeight: 180,
  border: `1px solid ${c.gray300}`,
  borderRadius: 8,
  padding: 14,
  resize: 'vertical',
  '&:focus': { outline: 'none' },
});
const Grid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 18,
});
const Actions = styled.div({ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 });
const Error = styled.p({ color: c.red, margin: 0 });
const Message = styled.p({ color: c.gray700, margin: 0 });

function toDateInput(value: string | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toLocalBoundary(value: string, endOfDay: boolean) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  ).toISOString();
}
