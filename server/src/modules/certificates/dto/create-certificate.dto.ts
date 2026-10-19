import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const MAX_CERTIFICATE_FILES = 5;

export class CreateCertificateDto {
  @IsString()
  @MaxLength(200)
  award!: string;

  @IsIn(['award', 'participation'])
  category!: 'award' | 'participation';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_CERTIFICATE_FILES)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  fileIds!: string[];
}
