import { IsIn, IsString } from 'class-validator';

export class PresignedUploadRequest {
  @IsIn(['public', 'private'])
  bucket!: 'public' | 'private';

  @IsString()
  contentType!: string;

  @IsString()
  fileName!: string;
}
