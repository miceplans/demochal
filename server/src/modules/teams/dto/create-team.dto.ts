import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

export class TeamRoleSlotDto {
  @IsString()
  @MaxLength(50)
  role!: string;

  @IsInt()
  @Min(1)
  count!: number;
}

export class CreateTeamDto {
  @IsUUID()
  challengeId!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamRoleSlotDto)
  openRoles?: TeamRoleSlotDto[];

  @IsString()
  @MaxLength(50)
  myRole!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;
}
