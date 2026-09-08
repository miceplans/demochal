'use client';
import { useState } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import {
  BizContent,
  PrimaryButton,
  OutlineButton,
  Field,
  FieldInput,
  FieldSelect,
} from '@/components/biz/BizShell';

const UploadBox = styled.div({
  border: `2px dashed ${c.lightBlue}`,
  background: '#f8f8f8',
  borderRadius: 20,
  padding: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  height: 282,
  fontSize: 12,
  color: c.gray500,
});
const UploadMark = styled.span({
  width: 57,
  height: 36,
  background: `radial-gradient(circle at 50% 120%, ${c.primary} 38%, #191f28 100%)`,
  clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
});
const TitleInput = styled.input({
  border: 0,
  outline: 'none',
  fontSize: 40,
  fontWeight: 600,
  '::placeholder': { color: c.gray300 },
});
const Section = styled.div({ display: 'flex', flexDirection: 'column', gap: 20 });
const Chips = styled.div({ display: 'flex', flexWrap: 'wrap', gap: 8 });
const Chip = styled.button<{ selected?: boolean }>(({ selected }) => ({
  border: `1px solid ${selected ? c.primary : c.gray200}`,
  borderRadius: 24,
  background: selected ? c.primary : c.white,
  color: selected ? c.white : c.gray700,
  fontSize: 13,
  padding: '8px 16px',
}));
const EditorBar = styled.div({
  display: 'flex',
  gap: 8,
  padding: 8,
  borderBottom: `1px solid #e9ecef`,
  fontSize: 12,
  color: c.gray500,
});
const Editor = styled.textarea({
  border: `1px solid #e9ecef`,
  borderRadius: 8,
  minHeight: 220,
  padding: '12px 16px',
  resize: 'vertical',
  '::placeholder': { color: c.gray300 },
});
const TwoCol = styled.div({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 });
const RadioRow = styled.label({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  color: c.gray700,
});
const Radio = styled.input({ accentColor: c.primary });
const Actions = styled.div({ display: 'flex', justifyContent: 'center', gap: 20 });

export function BizPostingFormPage() {
  const [topics, setTopics] = useState<string[]>(['IT/SW']);
  const toggle = (v: string) =>
    setTopics((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  return (
    <BizContent style={{ maxWidth: 1100 }}>
      <UploadBox>
        <UploadMark aria-hidden />
        파일 찾기
      </UploadBox>
      <TitleInput placeholder="제목을 입력해주세요" aria-label="공고 제목" />
      <Section>
        <Field>
          설명문구를 적어주세요.
          <FieldInput placeholder="공고 요약 설명" />
        </Field>
        <Field>
          해시태그를 적어주세요.
          <FieldInput placeholder="#해시태그" />
        </Field>
        <Field>
          상세정보를 적어주세요.
          <div>
            <EditorBar aria-hidden>
              <span>본문</span>
              <span>H1</span>
              <span>H2</span>
              <span>H3</span>
              <span>이미지</span>
              <span>리스트</span>
            </EditorBar>
            <Editor placeholder="상세정보를 적어주세요." />
          </div>
        </Field>
      </Section>
      <TwoCol>
        <Field>
          카테고리
          <FieldSelect defaultValue="IT/SW">
            {['IT/SW', '디자인', '창업/취업', '기획', '광고/마케팅', '대회', '해외'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </FieldSelect>
        </Field>
        <Field>
          주제
          <Chips role="group" aria-label="주제">
            {['IT/SW', '디자인', '창업', '기획', '마케팅'].map((x) => (
              <Chip
                key={x}
                type="button"
                selected={topics.includes(x)}
                aria-pressed={topics.includes(x)}
                onClick={() => toggle(x)}
              >
                {x}
              </Chip>
            ))}
          </Chips>
        </Field>
        <Field>
          모집방법
          <span style={{ display: 'flex', gap: 16 }}>
            <RadioRow>
              <Radio type="radio" name="recruit" defaultChecked />
              세모챌 팀 매칭
            </RadioRow>
            <RadioRow>
              <Radio type="radio" name="recruit" />
              외부 접수
            </RadioRow>
          </span>
        </Field>
        <Field>
          문의연락처
          <FieldInput placeholder="051-783-1170" />
        </Field>
        <Field>
          공개
          <span style={{ display: 'flex', gap: 16 }}>
            <RadioRow>
              <Radio type="radio" name="visibility" defaultChecked />
              공개
            </RadioRow>
            <RadioRow>
              <Radio type="radio" name="visibility" />
              비공개
            </RadioRow>
          </span>
        </Field>
      </TwoCol>
      <Actions>
        <OutlineButton type="button">취소하기</OutlineButton>
        <PrimaryButton>게시하기</PrimaryButton>
      </Actions>
    </BizContent>
  );
}
