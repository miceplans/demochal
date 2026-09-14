import { IsDateString, IsInt, IsOptional, IsPositive, IsString, IsUrl, IsUUID } from 'class-validator';

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

  @IsOptional()
  @IsInt()
  @IsPositive()
  expectedDailyPrice?: number;
}
