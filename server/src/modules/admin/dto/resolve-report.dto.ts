import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveReportDto {
  @IsIn(['resolve', 'dismiss'])
  action!: 'resolve' | 'dismiss';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
