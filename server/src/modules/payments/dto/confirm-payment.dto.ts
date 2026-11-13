import { IsIn, IsInt, IsOptional, IsPositive, IsString, IsUUID, Length } from 'class-validator';

export class ConfirmPaymentDto {
  @IsUUID()
  orderId!: string;

  /**
   * 결제 대행사. 기본값은 toss다. naverpay는 bz 서브도메인의 네이버페이 결제로,
   * paymentId(네이버페이 결제번호)를 대신 싣는다. 토스 경로에서는 여전히 필수다.
   */
  @IsOptional()
  @IsIn(['toss', 'naverpay'])
  provider?: 'toss' | 'naverpay';

  /** 토스 결제 키(successUrl 쿼리). provider=toss일 때 필수. */
  @IsOptional()
  @IsString()
  @Length(1, 200)
  paymentKey?: string;

  /** 네이버페이 결제번호(returnUrl 쿼리). provider=naverpay일 때 필수. */
  @IsOptional()
  @IsString()
  @Length(1, 200)
  paymentId?: string;

  /**
   * 주문 금액과 반드시 일치해야 한다 — 토스 승인 요청의 금액 위변조 방어.
   * provider=naverpay일 때는 서버 주문 금액만으로 대사하므로 받지 않는다.
   */
  @IsOptional()
  @IsInt()
  @IsPositive()
  amount?: number;
}
