'use client';
import { useState, type ChangeEvent } from 'react';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

const ICON = '/assets/icons';

const FormWrap = styled.div({
  width: '100%',
  maxWidth: 1100,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});

const Body = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 60,
});

/* ---------- 파일 업로더 ---------- */
const Uploader = styled.label({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 4,
  height: 282,
  padding: 8,
  background: '#f8f8f8',
  border: `2px dashed ${c.lightBlue}`,
  borderRadius: 20,
  cursor: 'pointer',
});
const UploadMark = styled.img({ width: 58, height: 36, objectFit: 'contain' });
const UploadText = styled.span({ ...textStyle.mInfoText, color: c.gray500 });

/* ---------- 제목 + 모집 역할 ---------- */
const TitleSection = styled.div({ display: 'flex', flexDirection: 'column', gap: 16 });
const TitleInput = styled.input({
  border: 0,
  outline: 'none',
  width: '100%',
  fontSize: 40,
  fontWeight: 600,
  '::placeholder': { color: c.gray500 },
});
const Roles = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  width: 592,
  maxWidth: '100%',
});
const RoleRow = styled.div({ display: 'flex', alignItems: 'center', gap: 8 });
const RoleIcon = styled.img({ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 });
const RoleInput = styled.input({
  flex: 1,
  minWidth: 0,
  height: 32,
  border: `1px solid ${c.gray300}`,
  borderRadius: 8,
  padding: '0 14px',
  '&:focus': { outline: 'none', borderColor: c.primary },
});
const AddRoleButton = styled.button({
  width: 24,
  height: 24,
  padding: 0,
  border: 0,
  background: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

/* ---------- 입력 필드 ---------- */
const Fields = styled.div({ display: 'flex', flexDirection: 'column', gap: 20 });
const FieldBlock = styled.div<{ wide?: boolean }>(({ wide }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: wide ? 10 : 8,
}));
const FieldLabel = styled.span({
  fontSize: 18,
  fontWeight: 400,
  letterSpacing: '-0.01em',
  color: c.gray900,
});
const LineInput = styled.input({
  width: '100%',
  height: 40,
  border: `1px solid ${c.gray300}`,
  borderRadius: 8,
  padding: '0 14px',
  '&:focus': { outline: 'none', borderColor: c.primary },
});

/* ---------- 텍스트 에디터 ---------- */
const EditorBox = styled.div({
  border: '1px solid #e9ecef',
  borderRadius: 8,
  background: c.white,
  overflow: 'hidden',
});
const MenuBar = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: 8,
  flexWrap: 'wrap',
});
const ToolGroup = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  padding: 2,
  border: '1px solid #e9ecef',
  borderRadius: 4,
});
const ToolButton = styled.button({
  width: 28,
  height: 28,
  border: 0,
  borderRadius: 4,
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:hover': { background: c.gray100 },
});
const ToolIcon = styled.img({ width: 20, height: 20, objectFit: 'contain' });
const DropdownButton = styled.button({
  height: 28,
  border: 0,
  borderRadius: 4,
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  ...textStyle.bodySmall,
  color: c.gray900,
  '&:hover': { background: c.gray100 },
});
const DropdownTextButton = styled(DropdownButton)({ padding: '0 4px 0 8px' });
const DropdownIconButton = styled(DropdownButton)({ padding: '0 4px' });
const ChevronIcon = styled.img({ width: 16, height: 16, objectFit: 'contain' });
const ContentsArea = styled.div({
  padding: '12px 16px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});
const SampleH1 = styled.p({ fontSize: 24, fontWeight: 700, lineHeight: 1.25 });
const SampleH2 = styled.p({ fontSize: 18, fontWeight: 700, lineHeight: 1.25 });
const SampleH3 = styled.p({ fontSize: 16, fontWeight: 700, lineHeight: 1.25 });
const SampleImage = styled.img({
  width: '100%',
  height: 507,
  objectFit: 'contain',
  marginTop: 12,
});

/* ---------- 카테고리 / 주제 ---------- */
const TwoCol = styled.div({
  display: 'flex',
  gap: 20,
  alignItems: 'flex-start',
});
const CategoryBlock = styled.div({ display: 'flex', flexDirection: 'column', gap: 10, flex: '1 1 280px' });
const TopicBlock = styled.div({ display: 'flex', flexDirection: 'column', gap: 8, flex: '2 1 0', minWidth: 0 });
const SelectWrap = styled.div({ position: 'relative' });
const CategorySelect = styled.select({
  width: '100%',
  height: 44,
  appearance: 'none',
  border: `1px solid ${c.gray200}`,
  borderRadius: 8,
  padding: '0 44px 0 14px',
  background: c.white,
  ...textStyle.mListText,
  cursor: 'pointer',
  'option': { color: c.gray900 },
  '&:focus': { outline: 'none', borderColor: c.primary },
});
const SelectIcon = styled.img({
  position: 'absolute',
  right: 12,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 24,
  height: 24,
  pointerEvents: 'none',
});
const Chips = styled.div({ display: 'flex', flexDirection: 'column', gap: 10 });
const ChipRow = styled.div({ display: 'flex', flexWrap: 'wrap', gap: 8 });
const Chip = styled.button<{ selected?: boolean }>(({ selected }) => ({
  padding: '8px 10px',
  borderRadius: 20,
  border: selected ? '1px solid transparent' : `1px solid ${c.gray300}`,
  background: selected ? c.primary : c.white,
  color: selected ? c.white : c.gray700,
  fontSize: 12,
  fontWeight: selected ? 600 : 400,
  '&:hover': { borderColor: selected ? 'transparent' : c.primary },
}));

/* ---------- 라디오 ---------- */
const RadioColumn = styled.div({ display: 'flex', flexDirection: 'column', gap: 16 });
const RadioOption = styled.label({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  ...textStyle.bodySmall,
  color: c.gray900,
});
const RadioInput = styled.input({
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
});
const RadioIcon = styled.img({ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 });
const LinkInput = styled.input({
  width: 470,
  maxWidth: '100%',
  height: 36,
  border: `1px solid ${c.gray200}`,
  borderRadius: 8,
  padding: '0 14px',
  '&:focus': { outline: 'none', borderColor: c.primary },
});

/* ---------- 문의연락처 ---------- */
const ContactInput = styled.input({
  width: '100%',
  height: 40,
  border: `1px solid ${c.gray200}`,
  borderRadius: 8,
  padding: '0 14px',
  '&:focus': { outline: 'none', borderColor: c.primary },
});

/* ---------- 하단 버튼 ---------- */
const Actions = styled.div({ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 });
const CancelButton = styled.button({
  width: 183,
  height: 37,
  border: `1px solid ${c.gray200}`,
  borderRadius: 6,
  background: c.white,
  color: c.gray900,
  ...textStyle.overline,
  '&:hover': { background: c.gray50 },
});
const PublishButton = styled.button({
  width: 183,
  height: 37,
  border: 0,
  borderRadius: 6,
  background: c.primary,
  color: c.white,
  ...textStyle.subtitle,
  '&:hover': { background: '#005ee0' },
});

const chipRows: string[][] = [
  ['# 비즈니스/스타트업', '# 경제/금융/투자', '# 과학/IT/AI', '# 마케팅/PR'],
  ['# 사회/역사', '# 인문/심리', '# 문화/예술/디자인', '# 게임', '# 여행/레저', '세미나', '인턴십'],
  ['# 운동/건강/웰빙', '# 자연/환경', '# 가족/육아', '#동식물/반려동물', '#음식/음료'],
  ['#영화/드라마/미디어', '#패션/뷰티', '# 자기계발/학습/독서', '# DIY/공예', '# 종교', '# 기타'],
];
const categories = ['IT/SW', '디자인', '창업/취업', '기획', '광고/마케팅', '대회', '해외'];

export function BizPostingFormPage() {
  const [roles, setRoles] = useState<string[]>(['', '']);
  const [topics, setTopics] = useState<string[]>(['# 비즈니스/스타트업', '# 가족/육아']);
  const [category, setCategory] = useState('');
  const [recruit, setRecruit] = useState<'semo' | 'external'>('semo');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  const toggleTopic = (topic: string) =>
    setTopics((s) => (s.includes(topic) ? s.filter((x) => x !== topic) : [...s, topic]));
  const changeRole = (index: number) => (e: ChangeEvent<HTMLInputElement>) =>
    setRoles((s) => s.map((v, i) => (i === index ? e.target.value : v)));

  return (
    <FormWrap>
      <Uploader>
        <input type="file" accept="image/*" style={{ display: 'none' }} />
        <UploadMark src={`${ICON}/fileuploader.png`} alt="" />
        <UploadText>파일 찾기</UploadText>
      </Uploader>

      <Body>
        <TitleSection>
          <TitleInput placeholder="제목을 입력해주세요" aria-label="공고 제목" />
          <Roles aria-label="모집 역할">
            <RoleRow>
              <RoleIcon src={`${ICON}/figma-role-calendar.svg`} alt="" />
              <RoleInput value={roles[0]} onChange={changeRole(0)} aria-label="모집 역할 1" />
            </RoleRow>
            <RoleRow>
              <RoleIcon src={`${ICON}/figma-role-people.svg`} alt="" />
              <RoleInput value={roles[1]} onChange={changeRole(1)} aria-label="모집 역할 2" />
            </RoleRow>
            <AddRoleButton type="button" onClick={() => setRoles((s) => [...s, ''])} aria-label="역할 추가">
              <RoleIcon src={`${ICON}/figma-role-add.svg`} alt="" />
            </AddRoleButton>
          </Roles>
        </TitleSection>

        <Fields>
          <FieldBlock>
            <FieldLabel>설명문구를 적어주세요.</FieldLabel>
            <LineInput aria-label="설명문구" />
          </FieldBlock>
          <FieldBlock>
            <FieldLabel>해시태그를 적어주세요.</FieldLabel>
            <LineInput aria-label="해시태그" />
          </FieldBlock>
          <FieldBlock>
            <FieldLabel>상세정보를 적어주세요.</FieldLabel>
            <EditorBox>
              <MenuBar role="toolbar" aria-label="텍스트 에디터">
                <ToolGroup>
                  <ToolButton type="button" aria-label="되돌리기">
                    <ToolIcon src={`${ICON}/figma-undo.svg`} alt="" />
                  </ToolButton>
                  <ToolButton type="button" aria-label="다시 실행">
                    <ToolIcon src={`${ICON}/figma-redo.svg`} alt="" />
                  </ToolButton>
                </ToolGroup>
                <ToolGroup>
                  <DropdownTextButton type="button">
                    Normal text
                    <ChevronIcon src={`${ICON}/figma-chevron-down.svg`} alt="" />
                  </DropdownTextButton>
                </ToolGroup>
                <ToolGroup>
                  <DropdownIconButton type="button" aria-label="텍스트 정렬">
                    <ToolIcon src={`${ICON}/figma-align-left.svg`} alt="" />
                    <ChevronIcon src={`${ICON}/figma-chevron-down.svg`} alt="" />
                  </DropdownIconButton>
                </ToolGroup>
                <ToolGroup>
                  <DropdownIconButton type="button" aria-label="색상">
                    <ToolIcon src={`${ICON}/figma-color-picker.svg`} alt="" />
                    <ChevronIcon src={`${ICON}/figma-chevron-down.svg`} alt="" />
                  </DropdownIconButton>
                </ToolGroup>
                <ToolGroup>
                  <ToolButton type="button" aria-label="굵게">
                    <ToolIcon src={`${ICON}/figma-bold.svg`} alt="" />
                  </ToolButton>
                  <ToolButton type="button" aria-label="기울임">
                    <ToolIcon src={`${ICON}/figma-italic.svg`} alt="" />
                  </ToolButton>
                  <ToolButton type="button" aria-label="밑줄">
                    <ToolIcon src={`${ICON}/figma-underline.svg`} alt="" />
                  </ToolButton>
                  <ToolButton type="button" aria-label="취소선">
                    <ToolIcon src={`${ICON}/figma-strike.svg`} alt="" />
                  </ToolButton>
                  <ToolButton type="button" aria-label="인라인 코드">
                    <ToolIcon src={`${ICON}/figma-code.svg`} alt="" />
                  </ToolButton>
                  <ToolButton type="button" aria-label="서식 지우기">
                    <ToolIcon src={`${ICON}/figma-clear-format.svg`} alt="" />
                  </ToolButton>
                </ToolGroup>
                <ToolGroup>
                  <ToolButton type="button" aria-label="글머리 기호 목록">
                    <ToolIcon src={`${ICON}/figma-bullet-list.svg`} alt="" />
                  </ToolButton>
                  <ToolButton type="button" aria-label="번호 매기기 목록">
                    <ToolIcon src={`${ICON}/figma-number-list.svg`} alt="" />
                  </ToolButton>
                </ToolGroup>
                <ToolGroup>
                  <ToolButton type="button" aria-label="링크">
                    <ToolIcon src={`${ICON}/figma-link.svg`} alt="" />
                  </ToolButton>
                  <ToolButton type="button" aria-label="이미지">
                    <ToolIcon src={`${ICON}/figma-image.svg`} alt="" />
                  </ToolButton>
                  <ToolButton type="button" aria-label="인용">
                    <ToolIcon src={`${ICON}/figma-quote.svg`} alt="" />
                  </ToolButton>
                  <ToolButton type="button" aria-label="구분선">
                    <ToolIcon src={`${ICON}/figma-rule.svg`} alt="" />
                  </ToolButton>
                </ToolGroup>
              </MenuBar>
              <ContentsArea>
                <SampleH1>Heading1</SampleH1>
                <SampleH2>Heading2</SampleH2>
                <SampleH3>Heading3</SampleH3>
                <SampleImage src="/mock/figma-posting-poster.png" alt="" />
              </ContentsArea>
            </EditorBox>
          </FieldBlock>

          <TwoCol>
            <CategoryBlock>
              <FieldLabel>카테고리</FieldLabel>
              <SelectWrap>
                <CategorySelect
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  aria-label="카테고리"
                  style={{ color: category ? c.gray900 : c.gray300 }}
                >
                  <option value="" disabled>
                    종류를 선택하세요
                  </option>
                  {categories.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </CategorySelect>
                <SelectIcon src={`${ICON}/Frame.png`} alt="" />
              </SelectWrap>
            </CategoryBlock>
            <TopicBlock>
              <FieldLabel>주제</FieldLabel>
              <Chips role="group" aria-label="주제">
                {chipRows.map((row, i) => (
                  <ChipRow key={i}>
                    {row.map((topic) => (
                      <Chip
                        key={topic}
                        type="button"
                        selected={topics.includes(topic)}
                        aria-pressed={topics.includes(topic)}
                        onClick={() => toggleTopic(topic)}
                      >
                        {topic}
                      </Chip>
                    ))}
                  </ChipRow>
                ))}
              </Chips>
            </TopicBlock>
          </TwoCol>

          <FieldBlock wide>
            <FieldLabel>모집방법</FieldLabel>
            <RadioColumn>
              <RadioOption>
                <RadioInput
                  type="radio"
                  name="recruit"
                  checked={recruit === 'semo'}
                  onChange={() => setRecruit('semo')}
                />
                <RadioIcon
                  src={recruit === 'semo' ? `${ICON}/figma-radio-on.svg` : `${ICON}/figma-radio-off.svg`}
                  alt=""
                />
                세모챌에서 만들기
              </RadioOption>
              <RoleRow>
                <RadioOption>
                  <RadioInput
                    type="radio"
                    name="recruit"
                    checked={recruit === 'external'}
                    onChange={() => setRecruit('external')}
                  />
                  <RadioIcon
                    src={recruit === 'external' ? `${ICON}/figma-radio-on.svg` : `${ICON}/figma-radio-off.svg`}
                    alt=""
                  />
                  외부 링크 추가
                </RadioOption>
                <LinkInput placeholder="https://" aria-label="외부 링크" />
              </RoleRow>
            </RadioColumn>
          </FieldBlock>

          <FieldBlock>
            <FieldLabel>문의연락처</FieldLabel>
            <ContactInput aria-label="문의연락처" />
          </FieldBlock>

          <FieldBlock wide>
            <FieldLabel>공개</FieldLabel>
            <RadioColumn>
              <RadioOption>
                <RadioInput
                  type="radio"
                  name="visibility"
                  checked={visibility === 'public'}
                  onChange={() => setVisibility('public')}
                />
                <RadioIcon
                  src={visibility === 'public' ? `${ICON}/figma-radio-on.svg` : `${ICON}/figma-radio-off.svg`}
                  alt=""
                />
                공개
              </RadioOption>
              <RadioOption>
                <RadioInput
                  type="radio"
                  name="visibility"
                  checked={visibility === 'private'}
                  onChange={() => setVisibility('private')}
                />
                <RadioIcon
                  src={visibility === 'private' ? `${ICON}/figma-radio-on.svg` : `${ICON}/figma-radio-off.svg`}
                  alt=""
                />
                비공개
              </RadioOption>
            </RadioColumn>
          </FieldBlock>
        </Fields>
      </Body>

      <Actions>
        <CancelButton type="button">취소하기</CancelButton>
        <PublishButton type="button">게시하기</PublishButton>
      </Actions>
    </FormWrap>
  );
}
