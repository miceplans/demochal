import { IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { MAX_UPLOAD_BYTES } from '../../files/dto/request-upload.dto.js';

export const MAX_CHALLENGE_ATTACHMENTS = 10;

/** 공고 첨부파일. 파일 본체는 files 테이블(private 버킷)에 있고 여기엔 표시용 이름·크기만 둔다. */
export class ChallengeAttachmentDto {
  @IsUUID()
  fileId!: string;

  @IsString()
  @MaxLength(255)
  @Matches(/^[^/\\]+$/)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  size!: number;
}
