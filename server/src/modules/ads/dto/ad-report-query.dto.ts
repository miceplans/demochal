import { IsDateString, IsOptional } from 'class-validator';

export class AdReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
