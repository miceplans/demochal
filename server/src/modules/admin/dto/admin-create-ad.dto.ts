import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

// 관리자 광고 직접 등록(POST /admin/ads). 결제·주문 없이 바로 진행중(active)으로 만든다.
export class AdminCreateAdDto {
  @IsUUID()
  businessId!: string;

  // ad_products.id는 UUID가 아닌 고정 문자열 슬롯 ID다(예: "hero").
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  productId!: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(200)
  title!: string;

  // 이미지가 없으면 공개 노출(listPublic)에서 빠지므로 필수다.
  @IsUUID()
  imageFileId!: string;

  @IsOptional()
  @IsUrl()
  landingUrl?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
