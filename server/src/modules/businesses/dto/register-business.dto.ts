import { IsString, Length, MaxLength } from 'class-validator';

export class RegisterBusinessDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @Length(10, 10)
  registrationNumber!: string;
}
