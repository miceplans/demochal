import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ApplicationAnswerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  questionId!: string;

  // The saved question determines the allowed value shape in ApplicationsService.
  @IsDefined()
  value!: string | string[];
}

export class ApplyChallengeDto {
  @IsUUID()
  challengeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

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
