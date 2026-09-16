import { IsDateString, IsOptional } from 'class-validator';

export class PaymentHistoryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
