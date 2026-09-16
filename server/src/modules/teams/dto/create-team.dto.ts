import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

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

  @IsString()
  title!: string;

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
