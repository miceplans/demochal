import { IsIn, IsString } from 'class-validator';

export class RequestUploadDto {
  @IsIn(['public', 'private'])
  bucket!: 'public' | 'private';

  @IsString()
  contentType!: string;

  @IsString()
  fileName!: string;
}
