import { IsIn, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCertificateDto {
  @IsString()
  @MaxLength(300)
  title!: string;

  @IsIn(['award', 'participation'])
  category!: 'award' | 'participation';

  @IsUUID()
  fileId!: string;
}
