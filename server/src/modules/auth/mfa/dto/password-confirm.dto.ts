import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** 수단 삭제·복구 코드 재발급 시 본인 확인용. */
export class PasswordConfirmDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
