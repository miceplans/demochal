import { IsIn, IsInt, Min } from 'class-validator';

// The request body is a bare array of these (see AdminAdsController) — Nest's
// global ValidationPipe skips built-in Array-typed params, so this is validated
// explicitly via ParseArrayPipe at the controller instead.
export class AdPricingEntryDto {
  @IsIn(['hero', 'gallery', 'team'])
  slot!: 'hero' | 'gallery' | 'team';

  @IsInt()
  @Min(0)
  dailyPrice!: number;
}
