import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SuspendUserDto {
  @IsBoolean()
  suspended!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
