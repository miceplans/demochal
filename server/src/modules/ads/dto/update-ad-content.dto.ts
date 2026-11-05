import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';

// 결제가 끝난 광고에 이미지·광고명(·링크)을 등록한다. 결제 → 이미지 업로드 → 광고명 순서라
// 생성(POST /ads) 시점에는 이 값들이 비어 있다.
export class UpdateAdContentDto {
  @IsUUID()
  imageFileId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsUrl()
  landingUrl?: string;
}
