import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ContentBlockDto {
  @IsIn(['link', 'text', 'file', 'layout', 'image'])
  type!: 'link' | 'text' | 'file' | 'layout' | 'image';

  @IsObject()
  content!: Record<string, unknown>;
}

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsUUID()
  bannerImageFileId?: string;

  @IsOptional()
  @IsUUID()
  logoImageFileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentBlockDto)
  contentBlocks?: ContentBlockDto[];
}
