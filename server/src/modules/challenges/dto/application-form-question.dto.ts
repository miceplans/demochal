import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// biz 콘솔 "신청서(질문지) 만들기" 화면이 다루는 질문 유형 6종.
export const APPLICATION_FORM_QUESTION_TYPES = [
  'dropdown',
  'checkbox',
  'radio',
  'file',
  'short',
  'long',
] as const;
export type ApplicationFormQuestionType = (typeof APPLICATION_FORM_QUESTION_TYPES)[number];

export class ApplicationFormQuestionDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @IsIn(APPLICATION_FORM_QUESTION_TYPES)
  type!: ApplicationFormQuestionType;

  // dropdown/checkbox/radio(선택형)일 때만 의미가 있다. 다른 유형은 빈 배열로 저장된다.
  // openapi 스펙과 계약을 맞추기 위해 생략을 허용한다(생략 시 저장 단계에서 []로 다룬다).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  options!: string[];

  @IsBoolean()
  required!: boolean;
}
