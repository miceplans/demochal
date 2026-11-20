import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateAdDto {
  // ad_products.id is a stable string slot ID (for example, "hero"), not a UUID.
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  productId!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsUUID()
  imageFileId?: string;

  // 랜딩 링크는 공개 광고로 노출되므로 http/https만 허용한다 — javascript:/data:
  // 같은 스킴은 저장 단계에서 거부한다.
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  landingUrl?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  // Required: the price the buyer confirmed before submitting. The server
  // rejects the request (409) if it no longer matches the product's price.
  @IsInt()
  @IsPositive()
  expectedDailyPrice!: number;
}
