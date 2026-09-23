import { IsIn, IsOptional, IsUUID } from 'class-validator';

const applicationStatuses = [
  'pending',
  'submitted',
  'reviewing',
  'needs_revision',
  'accepted',
  'rejected',
] as const;

export class ListManagedApplicationsDto {
  @IsOptional()
  @IsUUID()
  challengeId?: string;

  @IsOptional()
  @IsIn(applicationStatuses)
  status?: (typeof applicationStatuses)[number];
}
