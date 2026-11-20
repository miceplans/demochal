import { OmitType } from '@nestjs/swagger';
import { CreateChallengeDto } from './create-challenge.dto.js';

/**
 * 관리자 공고 일괄 등록 요청. 기업(businessId)은 주최(host) 이름으로 서버가 정하고,
 * 상태는 항상 published라 받지 않는다. 나머지 검증 규칙은 기업 등록(CreateChallengeDto)과 같다.
 */
export class AdminImportChallengeDto extends OmitType(CreateChallengeDto, [
  'businessId',
  'status',
] as const) {}
