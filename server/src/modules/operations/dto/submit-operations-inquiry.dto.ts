import { IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitOperationsInquiryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  contact!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;
}
