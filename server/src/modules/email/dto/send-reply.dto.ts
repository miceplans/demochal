import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendReplyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  text!: string;

  @IsString()
  @MaxLength(100_000)
  html = '';
}

export class SendNewEmailDto extends SendReplyDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(998)
  to!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(998)
  subject!: string;
}
