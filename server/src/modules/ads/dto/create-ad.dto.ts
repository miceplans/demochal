import {
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';

export class CreateAdDto {
  @IsUUID()
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
