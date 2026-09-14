import { IsIn, IsInt } from 'class-validator';

// The PUT body is a bare JSON array, so the controller binds it via
// ParseArrayPipe with this class as the per-item validated type.
export class AdPricingSlotDto {
  @IsIn(['hero', 'gallery', 'team'])
  slot!: 'hero' | 'gallery' | 'team';

  @IsInt()
  dailyPrice!: number;
}
