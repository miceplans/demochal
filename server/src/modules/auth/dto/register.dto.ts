import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export const TERMS_KEYS = ['privacy', 'business'] as const;
export type TermsKey = (typeof TERMS_KEYS)[number];

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  // Biz signup (`/biz/login`) fields — optional so the plain email signup keeps working.
  @IsOptional()
  @Matches(/^[a-z0-9_]{4,20}$/, { message: '아이디는 영문 소문자·숫자·_ 4~20자입니다.' })
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsUUID()
  emailVerificationId?: string;

  @IsOptional()
  @IsUUID()
  phoneVerificationId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(TERMS_KEYS, { each: true })
  agreements?: TermsKey[];
}
