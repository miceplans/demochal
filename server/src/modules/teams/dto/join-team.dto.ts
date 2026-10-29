import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class JoinTeamAnswerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  questionId!: string;

  // 저장된 질문(챌린지 신청서)이 값의 형태를 결정한다 — join()에서 검증한다.
  @IsDefined()
  value!: string | string[];
}

export class JoinTeamDto {
  @IsOptional()
  @IsString()
  role?: string;

  // 팀이 속한 챌린지의 신청서가 있을 때 지원자가 작성한 답변. 없는 질문이나 중복은 서버가 400으로 거부한다.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => JoinTeamAnswerDto)
  formAnswers?: JoinTeamAnswerDto[];
}
