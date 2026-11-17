import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class KcpConfirmDto {
  /** 승인 대상 주문 ID. */
  @IsUUID()
  orderId!: string;

  /** KCP 결제창 인증 결과 암호화 값 — 결제창이 낸 값을 그대로 전달한다(수정 금지). */
  @IsString()
  @Length(1, 4000)
  encData!: string;

  /** KCP 결제창 인증 결과 암호화 값 — 결제창이 낸 값을 그대로 전달한다(수정 금지). */
  @IsString()
  @Length(1, 4000)
  encInfo!: string;

  /** 결제창 인증 결과 요청 코드(PC 콜백에서 날아온 값). */
  @IsOptional()
  @IsString()
  @Length(1, 8)
  tranCd?: string;
}
