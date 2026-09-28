import { IsIn } from 'class-validator';

export const PUBLIC_AD_PLACEMENTS = ['hero', 'gallery'] as const;
export type PublicAdPlacement = (typeof PUBLIC_AD_PLACEMENTS)[number];

export class PublicAdsQueryDto {
  @IsIn(PUBLIC_AD_PLACEMENTS)
  placement!: PublicAdPlacement;
}
