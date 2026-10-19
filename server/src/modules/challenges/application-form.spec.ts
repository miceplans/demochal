import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { normalizeApplicationForm } from './application-form.js';
import type { ApplicationFormQuestionDto } from './dto/application-form-question.dto.js';

const q = (patch: Partial<ApplicationFormQuestionDto>): ApplicationFormQuestionDto => ({
  id: 'q1',
  title: '질문',
  type: 'short',
  options: [],
  required: true,
  ...patch,
});

describe('normalizeApplicationForm', () => {
  it('질문 ID가 중복되면 거절한다', () => {
    expect(() => normalizeApplicationForm([q({}), q({ title: '다른 질문' })])).toThrow(
      BadRequestException,
    );
  });

  it('선택형 질문의 선택지가 없거나 비어 있거나 중복이면 거절한다', () => {
    expect(() => normalizeApplicationForm([q({ type: 'radio', options: [] })])).toThrow(
      BadRequestException,
    );
    expect(() => normalizeApplicationForm([q({ type: 'radio', options: ['A', ' '] })])).toThrow(
      BadRequestException,
    );
    expect(() => normalizeApplicationForm([q({ type: 'checkbox', options: ['A', 'A'] })])).toThrow(
      BadRequestException,
    );
  });

  it('선택형이 아닌 질문의 options는 비우고, 제목·선택지는 공백을 다듬는다', () => {
    const [text, choice] = normalizeApplicationForm([
      q({ id: 'a', type: 'long', options: ['남은 값'] }),
      q({ id: 'b', title: ' 선택 ', type: 'dropdown', options: [' A ', 'B'] }),
    ]);
    expect(text?.options).toEqual([]);
    expect(choice).toMatchObject({ title: '선택', options: ['A', 'B'] });
  });
});
