import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApplicationAnswerDto } from './apply-challenge.dto.js';

export class UpdateApplicationDto {
  // --- 사업주(심사) 전용 필드 ---
  @IsOptional()
  @IsIn(['submitted', 'reviewing', 'needs_revision', 'accepted', 'rejected'])
  status?: 'submitted' | 'reviewing' | 'needs_revision' | 'accepted' | 'rejected';

  @IsOptional()
  @IsIn(['undecided', 'pass', 'fail'])
  evaluation?: 'undecided' | 'pass' | 'fail';

  @IsOptional()
  @IsString()
  managerMemo?: string;

  // --- 지원자 본인 수정 필드(서비스에서 소유자별로 화이트리스트 반영) ---
  // null은 저장된 역할 삭제(선택 해제)를 의미한다.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  teammates?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ApplicationAnswerDto)
  formAnswers?: ApplicationAnswerDto[];
}
