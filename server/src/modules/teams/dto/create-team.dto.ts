import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class TeamRoleSlotDto {
  @IsString()
  role!: string;

  @IsInt()
  @Min(1)
  count!: number;
}

export class CreateTeamDto {
  @IsUUID()
  challengeId!: string;

  // 생략하면 서버가 "<팀장 이름>의 팀"으로 채운다(모집글 작성 화면에는 팀명 입력이 없다).
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  introduction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  preferred?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  etc?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamRoleSlotDto)
  openRoles?: TeamRoleSlotDto[];

  @IsString()
  myRole!: string;

  @IsOptional()
  @IsString()
  region?: string;
}
