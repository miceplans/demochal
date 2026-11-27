import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { bizInquirySchema } from './schema';

const fieldErrors = (result: ReturnType<typeof bizInquirySchema.safeParse>) =>
  result.success ? {} : z.flattenError(result.error).fieldErrors;

describe('bizInquirySchema', () => {
  it('앞뒤 공백을 제거한 값을 돌려준다', () => {
    const result = bizInquirySchema.safeParse({
      name: '  홍길동 ',
      contact: ' 010-1234-5678',
      content: ' 견적이 궁금합니다. ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: '홍길동',
        contact: '010-1234-5678',
        content: '견적이 궁금합니다.',
      });
    }
  });

  it('공백만 있거나 비어 있으면 필수 입력 메시지를 돌려준다', () => {
    const result = bizInquirySchema.safeParse({ name: '   ', contact: '', content: '' });
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toEqual({
      name: ['성함을 입력해주세요.'],
      contact: ['연락처를 입력해주세요.'],
      content: ['문의 내용을 입력해주세요.'],
    });
  });

  it('최대 길이를 넘기면 길이 메시지를 돌려준다', () => {
    const result = bizInquirySchema.safeParse({
      name: '가'.repeat(101),
      contact: '1'.repeat(201),
      content: '가'.repeat(4001),
    });
    expect(result.success).toBe(false);
    expect(fieldErrors(result)).toEqual({
      name: ['성함은 100자 이내로 입력해주세요.'],
      contact: ['연락처는 200자 이내로 입력해주세요.'],
      content: ['문의 내용은 4,000자 이내로 입력해주세요.'],
    });
  });

  it('경계 길이(공백 제거 후)는 통과한다', () => {
    const result = bizInquirySchema.safeParse({
      name: ` ${'가'.repeat(100)} `,
      contact: '1'.repeat(200),
      content: '가'.repeat(4000),
    });
    expect(result.success).toBe(true);
  });
});
