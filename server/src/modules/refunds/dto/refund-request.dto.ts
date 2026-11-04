import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export enum RefundRequestStatus {
  Requested = 'requested',
  Approved = 'approved',
  Rejected = 'rejected',
}

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRefundRequestDto {
  @Transform(trimString)
  @IsString()
  @Length(1, 1000)
  reason!: string;
}

export class RejectRefundRequestDto {
  /** 구매자에게 알림으로 전달되는 반려 사유. */
  @Transform(trimString)
  @IsString()
  @Length(1, 1000)
  reason!: string;
}
