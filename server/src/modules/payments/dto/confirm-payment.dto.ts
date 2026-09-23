import { IsInt, IsPositive, IsString, IsUUID, Length } from 'class-validator';

export class ConfirmPaymentDto {
  @IsUUID()
  orderId!: string;

  @IsString()
  @Length(1, 200)
  paymentKey!: string;

  /** 주문 금액과 반드시 일치해야 한다 — 토스 승인 요청의 금액 위변조 방어. */
  @IsInt()
  @IsPositive()
  amount!: number;
}
