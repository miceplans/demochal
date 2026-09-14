import { IsIn } from 'class-validator';

// 'active' is set only by OrdersService.markPaid after a verified Toss payment —
// never accepted here, or a client could activate an ad without paying for it.
const STATUSES = ['paused', 'ended'] as const;

export class UpdateAdDto {
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];
}
