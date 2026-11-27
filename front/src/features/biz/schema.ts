import { z } from 'zod';

// 기존 수동 검증과 1:1 — 앞뒤 공백을 제거한 뒤 필수·최대 길이를 검사하고 메시지 문구도 같다.
export const bizInquirySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '성함을 입력해주세요.')
    .max(100, '성함은 100자 이내로 입력해주세요.'),
  contact: z
    .string()
    .trim()
    .min(1, '연락처를 입력해주세요.')
    .max(200, '연락처는 200자 이내로 입력해주세요.'),
  content: z
    .string()
    .trim()
    .min(1, '문의 내용을 입력해주세요.')
    .max(4000, '문의 내용은 4,000자 이내로 입력해주세요.'),
});

export type BizInquiryFormValues = z.infer<typeof bizInquirySchema>;
