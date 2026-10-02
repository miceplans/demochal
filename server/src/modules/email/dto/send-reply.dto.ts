import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendReplyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  text!: string;

  @IsString()
  @MaxLength(100_000)
  html = '';
}
