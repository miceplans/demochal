'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [capacity, setCapacity] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    adApi.businesses
      .me()
      .then((business) => active && setBusinessId(business.id))
      .catch((cause) => active && setError(adError(cause)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

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
      const challenge = await adApi.challenges.create({
        businessId,
        title: title.trim(),
        description: description.trim(),
        price: parsedPrice,
        capacity: parsedCapacity,
        startDate: toLocalBoundary(startDate, false),
        endDate: toLocalBoundary(endDate, true),
        category: category || null,
      });
      router.push(hrefOf(`/postings/${challenge.id}`));
    } catch (cause) {
      setError(adError(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BizContent>
      <Header>
        <h1>공고 만들기</h1>
        <p>공고 정보를 입력하면 비즈니스 계정으로 등록됩니다.</p>
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
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </FieldSelect>
        </Field>
        {error && <Error role="alert">{error}</Error>}
        <Actions>
          <OutlineButton type="button" onClick={() => router.back()}>
            취소
          </OutlineButton>
          <PrimaryButton type="submit" disabled={loading || submitting || !businessId}>
            {loading ? '계정 확인 중…' : submitting ? '등록 중…' : '공고 등록'}
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
