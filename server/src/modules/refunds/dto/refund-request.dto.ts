import { IsString, Length, Matches } from 'class-validator';

// 서비스는 사유를 trim해 저장하므로, 공백만 있는 값이 빈 사유로 저장되지 않게 막는다.
const NOT_BLANK = /\S/;
const NOT_BLANK_MESSAGE = '사유를 입력해 주세요.';

export class CreateRefundRequestDto {
  @IsString()
  @Length(1, 1000)
  @Matches(NOT_BLANK, { message: NOT_BLANK_MESSAGE })
  reason!: string;
}

export class RejectRefundRequestDto {
  /** 구매자에게 알림으로 전달되는 반려 사유. */
  @IsString()
  @Length(1, 1000)
  @Matches(NOT_BLANK, { message: NOT_BLANK_MESSAGE })
  reason!: string;
}
