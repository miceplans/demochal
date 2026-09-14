import { IsIn, IsOptional, IsString } from 'class-validator';

export class VerifyCertificateDto {
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  reason?: string;
}
