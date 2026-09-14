import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsObject, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  bannerImageFileId?: string;

  @IsOptional()
  @IsUUID()
  logoImageFileId?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentBlockDto)
  contentBlocks?: ContentBlockDto[];
}

export class ContentBlockDto {
  @IsString()
  type!: string;

  @IsObject()
  content!: Record<string, unknown>;
}
