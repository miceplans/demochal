import {
  IsOptional,
  IsIn,
  IsInt,
  IsMimeType,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  // 공고 첨부파일(private 버킷 전용 — 공개 버킷은 WebP만 받는다)
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/x-hwp',
  'application/hwp+zip',
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

  // 'poster'면 공개 버킷에 JPG/PNG/WebP 원본을 변환 없이 올린다(공고 포스터 전용).
  @IsOptional()
  @IsIn(['poster'])
  purpose?: 'poster';
}
