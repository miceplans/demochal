import { IsEmail, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  // Either email or username (biz accounts) identifies the account.
  @ValidateIf((dto: LoginDto) => !dto.username)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  username?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
