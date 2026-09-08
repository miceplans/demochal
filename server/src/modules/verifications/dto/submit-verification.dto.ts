import { IsUUID } from 'class-validator';

export class SubmitVerificationDto {
  @IsUUID()
  businessId!: string;

  @IsUUID()
  documentFileId!: string;
}
