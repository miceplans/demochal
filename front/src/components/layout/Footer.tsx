import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* 회사 소개 */}
          <div>
            <h3 className="text-white font-semibold mb-4">세모챌</h3>
            <p className="text-sm leading-relaxed">
              청년들의 대외활동과 공모전을 연결하는 플랫폼입니다. 
              AI 기반 추천으로 적합한 챌린지를 찾고, 팀원 모집부터 지원까지 편리하게 진행하세요.
            </p>
          </div>

          {/* 서비스 */}
          <div>
            <h3 className="text-white font-semibold mb-4">서비스</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/explore" className="hover:text-white transition-colors">
                  챌린지 검색
                </Link>
              </li>
              <li>
                <Link href="/teams" className="hover:text-white transition-colors">
                  팀원모집
                </Link>
              </li>
              <li>
                <Link href="/my/applications" className="hover:text-white transition-colors">
                  내 지원내역
                </Link>
              </li>
              <li>
                <Link href="/profile" className="hover:text-white transition-colors">
                  프로필
                </Link>
              </li>
            </ul>
          </div>

          {/* 기관회원 */}
          <div>
            <h3 className="text-white font-semibold mb-4">기관회원</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/biz" className="hover:text-white transition-colors">
                  기관회원센터
                </Link>
              </li>
              <li>
                <Link href="/biz/ads" className="hover:text-white transition-colors">
                  광고상품 안내
                </Link>
              </li>
              <li>
                <Link href="/advertising" className="hover:text-white transition-colors">
                  광고 운영정책
                </Link>
              </li>
              <li>
                <Link href="/biz/login" className="hover:text-white transition-colors">
                  기관회원 로그인
                </Link>
              </li>
            </ul>
          </div>

          {/* 정보 */}
          <div>
            <h3 className="text-white font-semibold mb-4">정보</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="/youth" className="hover:text-white transition-colors">
                  청소년보호정책
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <a href="mailto:contact@semochal.com" className="hover:text-white transition-colors">
                  고객센터
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 text-sm text-center">
          <p>&copy; {currentYear} 세모챌. All rights reserved.</p>
          <p className="mt-2 text-xs text-gray-500">
            본 서비스는 (주)OOO 가 운영합니다.
          </p>
        </div>
      </div>
    </footer>
  );
}
