import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class VerifyCertificateDto {
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
