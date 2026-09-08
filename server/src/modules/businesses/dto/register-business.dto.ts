import { IsString, Length } from 'class-validator';

export class RegisterBusinessDto {
  @IsString()
  name!: string;

  @IsString()
  @Length(10, 10)
  registrationNumber!: string;
}
