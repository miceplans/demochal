import { ExplorePage } from '@/components/contests/ExplorePage';
// 팀 탐색은 비로그인도 볼 수 있다. 로그인은 모집글 상세의 "팀 신청하기"에서만 요구한다.
export default function Page() {
  return <ExplorePage teamMode />;
}
