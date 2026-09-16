import { IsArray, IsString } from 'class-validator';

export class SaveInterestsDto {
  @IsArray()
  @IsString({ each: true })
  categories!: string[];
}
