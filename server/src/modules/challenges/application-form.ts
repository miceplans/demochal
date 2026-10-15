import { BadRequestException } from '@nestjs/common';
import type { ApplicationFormQuestionDto } from './dto/application-form-question.dto.js';

const CHOICE_TYPES = new Set(['dropdown', 'checkbox', 'radio']);

/**
 * 신청서 질문 정의를 저장 전에 검증·정규화한다.
 * - id 중복: 신청 시 답변 검증(validateFormAnswers)이 전부 실패해 아무도 신청할 수 없게 된다.
 * - 선택형에 선택지가 없거나 비었거나 중복: 답변 불가능한 질문이 된다.
 * - 선택형이 아닌 질문의 options는 의미가 없으므로 []로 비운다.
 */
export function normalizeApplicationForm(
  questions: ApplicationFormQuestionDto[],
): ApplicationFormQuestionDto[] {
  const ids = new Set<string>();
  return questions.map((question) => {
    if (ids.has(question.id)) {
      throw new BadRequestException('신청서 질문 ID가 중복되었습니다.');
    }
    ids.add(question.id);

    const title = question.title.trim();
    if (!title) throw new BadRequestException('신청서 질문 내용을 입력해 주세요.');

    if (!CHOICE_TYPES.has(question.type)) return { ...question, title, options: [] };

    const options = (question.options ?? []).map((option) => option.trim());
    if (options.length === 0 || options.some((option) => !option)) {
      throw new BadRequestException(`“${title}” 질문의 선택지를 모두 입력해 주세요.`);
    }
    if (new Set(options).size !== options.length) {
      throw new BadRequestException(`“${title}” 질문의 선택지가 중복되었습니다.`);
    }
    return { ...question, title, options };
  });
}
