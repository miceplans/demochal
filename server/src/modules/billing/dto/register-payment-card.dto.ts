import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterPaymentCardDto {
  @IsString()
  @MaxLength(500)
  billingKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cardName?: string;

  // Not in the documented request schema, but required here: Toss returns the masked
  // card number to the client at billing-key-issue time, and the server has no other
  // way to obtain it (raw card numbers never reach us — PCI scope stays with Toss).
  @IsString()
  @MaxLength(30)
  maskedNumber!: string;
}
