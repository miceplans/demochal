import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateChallengeDto } from './update-challenge.dto.js';

const question = {
  id: 'q-1',
  title: '질문 제목',
  type: 'short',
  options: [],
  required: false,
};

// validate()의 중첩 오류는 `applicationForm` -> 배열 인덱스("0") -> 실제 필드 순으로
// children이 쌓인다. 첫 번째 위반 필드의 constraints만 꺼낸다.
function firstQuestionConstraints(errors: Awaited<ReturnType<typeof validate>>) {
  const nested = errors.find((error) => error.property === 'applicationForm');
  return nested?.children?.[0]?.children?.[0]?.constraints;
}

describe('UpdateChallengeDto', () => {
  it('accepts a valid http(s) recruitUrl or omitting it entirely', async () => {
    for (const recruitUrl of [
      'https://example.com/apply',
      'http://forms.example.com/path?x=1',
      undefined,
    ]) {
      const dto = Object.assign(
        new UpdateChallengeDto(),
        recruitUrl === undefined ? {} : { recruitUrl },
      );

      const errors = await validate(dto);

      expect(errors.map((error) => error.property)).not.toContain('recruitUrl');
    }
  });

  it('rejects an invalid or non-http(s) recruitUrl', async () => {
    for (const recruitUrl of [null, 'not-a-url', 'ftp://example.com/file', '   ', 'example.com']) {
      const dto = Object.assign(new UpdateChallengeDto(), { recruitUrl });

      const errors = await validate(dto);

      expect(errors.map((error) => error.property)).toEqual(['recruitUrl']);
    }
  });

  it('rejects a recruitUrl longer than 2048 characters', async () => {
    const recruitUrl = `https://example.com/${'a'.repeat(2040)}`;
    const dto = Object.assign(new UpdateChallengeDto(), { recruitUrl });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(['recruitUrl']);
  });

  it('still allows clearing category with null while validating recruitUrl independently', async () => {
    const dto = Object.assign(new UpdateChallengeDto(), {
      category: null,
      recruitUrl: 'https://example.com/apply',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});

describe('UpdateChallengeDto.applicationForm', () => {
  it('accepts a well-formed question list covering every question type', async () => {
    for (const type of ['dropdown', 'checkbox', 'radio', 'file', 'short', 'long']) {
      const dto = plainToInstance(UpdateChallengeDto, {
        applicationForm: [{ ...question, type }],
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    }
  });

  it('allows an empty question list (clears the saved form)', async () => {
    const dto = plainToInstance(UpdateChallengeDto, { applicationForm: [] });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects a question with an empty title', async () => {
    const dto = plainToInstance(UpdateChallengeDto, {
      applicationForm: [{ ...question, title: '' }],
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('applicationForm');
    expect(firstQuestionConstraints(errors)).toHaveProperty('isNotEmpty');
  });

  it('rejects a question type outside the 6-type enum', async () => {
    const dto = plainToInstance(UpdateChallengeDto, {
      applicationForm: [{ ...question, type: 'essay' }],
    });

    const errors = await validate(dto);

    expect(firstQuestionConstraints(errors)).toHaveProperty('isIn');
  });

  it('rejects a question missing the required flag', async () => {
    const { required: _required, ...withoutRequired } = question;
    const dto = plainToInstance(UpdateChallengeDto, {
      applicationForm: [withoutRequired],
    });

    const errors = await validate(dto);

    expect(firstQuestionConstraints(errors)).toHaveProperty('isBoolean');
  });

  it('rejects a non-string option in a choice question', async () => {
    const dto = plainToInstance(UpdateChallengeDto, {
      applicationForm: [{ ...question, type: 'radio', options: ['ok', 42] }],
    });

    const errors = await validate(dto);

    expect(firstQuestionConstraints(errors)).toHaveProperty('isString');
  });

  it('is optional — omitting the field entirely is valid', async () => {
    const dto = plainToInstance(UpdateChallengeDto, { title: '제목만 수정' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts a choice question omitting options (openapi contract)', async () => {
    const { options: _options, ...withoutOptions } = question;
    const dto = plainToInstance(UpdateChallengeDto, {
      applicationForm: [{ ...withoutOptions, type: 'radio' }],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects more than 100 questions', async () => {
    const dto = plainToInstance(UpdateChallengeDto, {
      applicationForm: Array.from({ length: 101 }, () => ({ ...question })),
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('applicationForm');
  });

  it('rejects more than 50 options in a choice question', async () => {
    const dto = plainToInstance(UpdateChallengeDto, {
      applicationForm: [
        {
          ...question,
          type: 'checkbox',
          options: Array.from({ length: 51 }, (_, i) => `옵션 ${i + 1}`),
        },
      ],
    });

    const errors = await validate(dto);

    expect(firstQuestionConstraints(errors)).toHaveProperty('arrayMaxSize');
  });

  it('rejects an option longer than 500 characters', async () => {
    const dto = plainToInstance(UpdateChallengeDto, {
      applicationForm: [
        { ...question, type: 'dropdown', options: [`${'a'.repeat(501)}`] },
      ],
    });

    const errors = await validate(dto);

    expect(firstQuestionConstraints(errors)).toHaveProperty('maxLength');
  });
});
