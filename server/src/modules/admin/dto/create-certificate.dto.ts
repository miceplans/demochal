import { IsIn, IsString, IsUUID } from 'class-validator';

export class CreateCertificateDto {
  @IsString()
  title!: string;

  @IsIn(['award', 'participation'])
  category!: 'award' | 'participation';

  @IsUUID()
  fileId!: string;
}
