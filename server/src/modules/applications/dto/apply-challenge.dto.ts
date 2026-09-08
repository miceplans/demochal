import { IsUUID } from 'class-validator';

export class ApplyChallengeDto {
  @IsUUID()
  challengeId!: string;
}
