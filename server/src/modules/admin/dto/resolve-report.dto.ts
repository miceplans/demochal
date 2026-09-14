import { IsIn, IsOptional, IsString } from 'class-validator';

export class ResolveReportDto {
  @IsIn(['resolve', 'dismiss'])
  action!: 'resolve' | 'dismiss';

  @IsOptional()
  @IsString()
  note?: string;
}
