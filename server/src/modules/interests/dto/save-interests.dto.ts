import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class SaveInterestsDto {
  // 빈 배열 저장을 허용하면 users.interests가 []가 되어 GET /interests의
  // 온볼딩 설문 평백이 다시 발동한다. 빈 관심분야는 "아직 설정 안 함"과 구분할
  // 수 없으므로 1개 이상을 요구한다.
  @ArrayNotEmpty()
  @IsArray()
  @IsString({ each: true })
  categories!: string[];
}
