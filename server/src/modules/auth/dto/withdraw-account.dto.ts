import {
  Equals,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class TeamTransferDto {
  @IsUUID()
  teamId!: string;

  @IsUUID()
  newLeaderUserId!: string;
}

export class WithdrawAccountDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @Equals('회원 탈퇴')
  confirmation!: '회원 탈퇴';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamTransferDto)
  teamTransfers?: TeamTransferDto[];

  @IsOptional()
  @IsUUID()
  newBusinessOwnerUserId?: string;
}
