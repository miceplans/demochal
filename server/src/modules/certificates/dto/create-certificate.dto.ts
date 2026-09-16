import { IsIn, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCertificateDto {
  @IsString()
  @MaxLength(200)
  award!: string;

  @IsIn(['award', 'participation'])
  category!: 'award' | 'participation';

  @IsUUID()
  fileId!: string;
}
