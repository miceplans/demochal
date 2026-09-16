import { IsIn, IsInt, IsMimeType, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedUploadContentType = (typeof ALLOWED_UPLOAD_CONTENT_TYPES)[number];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class RequestUploadDto {
  @IsIn(['public', 'private'])
  bucket!: 'public' | 'private';

  @IsString()
  @IsMimeType()
  @IsIn(ALLOWED_UPLOAD_CONTENT_TYPES)
  @MaxLength(100)
  contentType!: AllowedUploadContentType;

  @IsString()
  @MaxLength(255)
  @Matches(/^[^/\\]+$/)
  fileName!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  sizeBytes!: number;
}
