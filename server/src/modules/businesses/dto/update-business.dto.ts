import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

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

  // 프로필 구글 지도 핀 좌표. 명시적 null이면 핀을 제거한다(둘 다 없으면 지도는 주소 기준 표시).
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  mapLatitude?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  mapLongitude?: number | null;

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
