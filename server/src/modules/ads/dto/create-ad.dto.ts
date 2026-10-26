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

  @IsOptional()
  @IsUrl()
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
