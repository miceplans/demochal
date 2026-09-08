import { IsDateString, IsInt, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateChallengeDto {
  @IsUUID()
  businessId!: string;

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsInt()
  @IsPositive()
  price!: number;

  @IsInt()
  @IsPositive()
  capacity!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
