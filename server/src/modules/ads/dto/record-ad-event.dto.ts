import { IsOptional, IsUUID } from 'class-validator';

export class RecordAdEventDto {
  /** Client-generated id used only for short-lived duplicate suppression. */
  @IsOptional()
  @IsUUID()
  eventId?: string;
}
