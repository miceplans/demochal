import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class KcpRegisterDto {
  /** 거래등록할 주문 ID — 본인의 pending 주문이어야 한다. */
  @IsUUID()
  orderId!: string;

  /** KCP 결제창에 노출할 상품명 — 표시용이며, 권위 있는 금액 대사는 승인 단계에서 다시 한다. */
  @IsString()
  @Length(1, 100)
  orderName!: string;

  /** 결제 흐름 — 모바일 인증 결과 복귀 화면 분기용으로 KCP param_opt_1에 실린다. */
  @IsOptional()
  @IsIn(['ad', 'design'])
  flow?: 'ad' | 'design';
}
