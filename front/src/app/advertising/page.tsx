'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function AdvertisingPolicyPage() {
  const [activeSection, setActiveSection] = useState('chapter1');

  const chapters = [
    { id: 'chapter1', title: '제1조 (목적)', content: getChapterContent('chapter1') },
    { id: 'chapter2', title: '제2조 (용어의 정의)', content: getChapterContent('chapter2') },
    { id: 'chapter3', title: '제3조 (광고서비스 상품 구성)', content: getChapterContent('chapter3') },
    { id: 'chapter4', title: '제4조 (광고 신청 및 심사)', content: getChapterContent('chapter4') },
    { id: 'chapter5', title: '제5조 (게재 및 노출)', content: getChapterContent('chapter5') },
    { id: 'chapter6', title: '제6조 (요금 및 결제)', content: getChapterContent('chapter6') },
    { id: 'chapter7', title: '제7조 (취소 및 환불)', content: getChapterContent('chapter7') },
    { id: 'chapter8', title: '제8조 (성과 리포트 제공)', content: getChapterContent('chapter8') },
    { id: 'chapter9', title: '제9조 (기관회원의 의무)', content: getChapterContent('chapter9') },
    { id: 'chapter10', title: '제10조 (회사의 면책)', content: getChapterContent('chapter10') },
    { id: 'chapter11', title: '제11조 (계약 해지 및 제재)', content: getChapterContent('chapter11') },
    { id: 'chapter12', title: '제12조 (분쟁해결)', content: getChapterContent('chapter12') },
    { id: 'chapter13', title: '제13조 (정책의 개정)', content: getChapterContent('chapter13') },
  ];

  const notices = [
    {
      title: '⚠️ 검토 필요 안내',
      items: [
        '- **가격표**는 운영계획 문서(세모챌_운영계획_260824.pdf)에 있던 참고 가격대를 그대로 인용했습니다. 실제 확정 가격표로 교체하고, "예상 견적"인지 "확정가"인지 명확히 해주세요.',
        '- **환불 공제 기준**(일할 계산 방식 등)은 정책상 원칙만 세웠고, 구체적 계산식/표는 실제 상품 설계 확정 후 별첨으로 추가하는 것을 권장합니다.',
        '- 프리미엄 패키지처럼 **제작 용역이 포함된 상품**은 콘텐츠분쟁조정위원회 기준상 청약철회 제한 사유(이미 용역이 개시된 경우)에 해당할 수 있어, 전자상거래법 자문을 별도로 받는 게 안전합니다.',
        '- 제4조 심사기준은 청소년보호정책·이용약관과 연동되므로, 세 문서의 표현을 나중에 한 번 더 교차 검토해 용어를 통일하는 걸 추천합니다.',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">세모챌 광고 운영정책</h1>
          <p className="mt-2 text-sm text-gray-500">BIZ 회원용 | 시행일자: 20XX년 XX월 XX일</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 목차 */}
          <aside className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">목차</CardTitle>
              </CardHeader>
              <CardContent>
                <nav className="space-y-2">
                  {chapters.map((chapter) => (
                    <button
                      key={chapter.id}
                      onClick={() => setActiveSection(chapter.id)}
                      className={cn(
                        'w-full text-left px-4 py-3 rounded-lg transition-colors',
                        activeSection === chapter.id
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'hover:bg-gray-50 text-gray-700'
                      )}
                    >
                      {chapter.title}
                    </button>
                  ))}
                </nav>

                <div className="mt-8 pt-6 border-t">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">관련 문서</h3>
                  <div className="space-y-2">
                    <Link href="/terms" className="block px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm text-gray-700">
                      이용약관
                    </Link>
                    <Link href="/youth" className="block px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm text-gray-700">
                      청소년보호정책
                    </Link>
                    <Link href="/privacy" className="block px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm text-gray-700">
                      개인정보처리방침
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* 본문 */}
          <div className="lg:col-span-2 space-y-6">
            {chapters.map((chapter) => (
              <Card key={chapter.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{chapter.title}</CardTitle>
                    <Badge variant={activeSection === chapter.id ? 'default' : 'secondary'}>
                      {activeSection === chapter.id ? '현재 섹션' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="prose prose-sm max-w-none">
                  {chapter.content}
                </CardContent>
              </Card>
            ))}

            {/* 검토 필요 안내 */}
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="text-lg text-yellow-800">{notices[0].title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {notices[0].items.map((item, index) => (
                    <li key={index} className="text-sm text-yellow-700 leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* 법적 주의사항 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-blue-900 font-semibold mb-3">법적 주의사항</h3>
              <p className="text-sm text-blue-700 leading-relaxed">
                본 광고 운영정책은 대한민국 관련 법령(표시광고의 공정화에 관한 법률, 청소년보호법, 전자상거래법 등)을 준수하도록 작성되었습니다. 
                하지만 서비스의 구체적인 운영 정책, 상품 내용 등에 따라 추가 조항이 필요할 수 있습니다.
                게시 전 반드시 법률 전문가와 검토하시기 바랍니다.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function getChapterContent(chapterId: string): React.ReactNode {
  switch (chapterId) {
    case 'chapter1':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제1조 (목적)</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            이 정책은 광고서비스의 상품 구성, 신청 및 심사 절차, 게재 기준, 요금 및 정산, 성과 리포트 제공, 취소·환불, 광고주(기관회원)의 의무와 책임을 명확히 하여 건전한 광고 생태계를 유지함을 목적으로 합니다.
          </p>
        </>
      );

    case 'chapter2':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제2조 (용어의 정의)</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
            <li>"광고서비스"란 기관회원이 유상으로 이용하는 챌린지 노출 강화, 타깃 홍보, 프리미엄 패키지, 운영대행 연계 등 일체의 유료 상품을 의미합니다.</li>
            <li>"광고소재"란 광고서비스 게재를 위해 기관회원이 제출하는 이미지, 텍스트, 랜딩페이지, 카드뉴스 등의 콘텐츠를 의미합니다.</li>
            <li>"게재기간"이란 광고소재가 서비스 내에 노출되는 기간을 의미합니다.</li>
            <li>"성과 리포트"란 광고서비스 이용 결과로 회사가 제공하는 조회수, 클릭수, 저장수, 뉴스레터 오픈율 등 통계 자료를 의미합니다.</li>
          </ol>
        </>
      );

    case 'chapter3':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제3조 (광고서비스 상품 구성)</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            회사가 제공하는 광고서비스는 다음과 같으며, 세부 가격 및 조건은 서비스 내 별도 상품 안내 페이지에 따릅니다.
          </p>
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-3 py-2 text-left font-medium">상품명</th>
                  <th className="border px-3 py-2 text-left font-medium">주요 내용</th>
                  <th className="border px-3 py-2 text-left font-medium">참고 가격대</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border px-3 py-2">무료 등록</td>
                  <td className="border px-3 py-2">기본 공고 DB 확보, 챌린지 검색·목록 노출</td>
                  <td className="border px-3 py-2">0원</td>
                </tr>
                <tr>
                  <td className="border px-3 py-2">추천 챌린지</td>
                  <td className="border px-3 py-2">메인·카테고리 상단 노출</td>
                  <td className="border px-3 py-2">약 10~50만원</td>
                </tr>
                <tr>
                  <td className="border px-3 py-2">타깃 홍보</td>
                  <td className="border px-3 py-2">관심분야별 뉴스레터·SNS 홍보</td>
                  <td className="border px-3 py-2">약 50~200만원</td>
                </tr>
                <tr>
                  <td className="border px-3 py-2">프리미엄 패키지</td>
                  <td className="border px-3 py-2">랜딩페이지·카드뉴스·성과 리포트 제작</td>
                  <td className="border px-3 py-2">약 200~700만원</td>
                </tr>
                <tr>
                  <td className="border px-3 py-2">운영대행 연계</td>
                  <td className="border px-3 py-2">접수·심사·시상식 등 운영 전체 대행</td>
                  <td className="border px-3 py-2">별도 견적</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            ※ 상기 가격대는 참고용 기준이며, 회사는 시장 상황, 상품 개편 등에 따라 가격 및 상품 구성을 변경할 수 있고 변경 시 사전 공지합니다.
          </p>
        </>
      );

    case 'chapter4':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제4조 (광고 신청 및 심사)</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
            <li>광고서비스는 승인된 기관회원만 신청할 수 있으며, 신청 시 광고소재, 게재기간, 희망 상품, 챌린지 정보(연동 시)를 제출하여야 합니다.</li>
            <li>회사는 신청된 광고소재에 대해 다음 기준으로 사전 심사를 진행하며, 심사에는 통상 영업일 기준 2~3일이 소요될 수 있습니다.
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>챌린지 정보의 사실성(실재 여부, 모집기간·자격·시상내역의 정확성)</li>
                <li>「표시·광고의 공정화에 관한 법률」상 허위·과장 광고 해당 여부</li>
                <li>청소년보호정책 및 관계 법령(청소년보호법 등) 위반 여부</li>
                <li>저작권 등 제3자 권리 침해 여부</li>
                <li>서비스 디자인 가이드(이미지 규격, 텍스트 분량 등) 준수 여부</li>
              </ul>
            </li>
            <li>회사는 심사 결과 다음 각 호에 해당하는 광고소재의 게재를 거부하거나 수정을 요청할 수 있습니다.
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>사실과 다르거나 소비자를 오인시킬 우려가 있는 표현(예: 확정되지 않은 상금·특전을 확정된 것처럼 표기)</li>
                <li>청소년에게 유해하거나 부적절한 내용</li>
                <li>특정 개인·단체에 대한 비방, 명예훼손 소지가 있는 내용</li>
                <li>도박, 사행성, 대출, 다단계 등 관련 법령상 광고가 제한되는 업종</li>
                <li>타 공모전·대회 정보 플랫폼 또는 경쟁 서비스의 명시적 비방</li>
                <li>세모챌의 서비스 정체성(정보 신뢰성, 청년 친화적 이미지)에 반한다고 회사가 합리적으로 판단하는 내용</li>
              </ul>
            </li>
            <li>광고소재는 관련 법령 및 회사 정책 변경, 사회적 이슈 발생 등에 따라 게재 중이라도 재심사를 거쳐 노출이 중단될 수 있습니다.</li>
          </ol>
        </>
      );

    case 'chapter5':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제5조 (게재 및 노출)</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
            <li>광고서비스는 회사가 상품별로 정한 위치(메인 상단, 카테고리 상단, 뉴스레터, SNS 등)에 계약된 게재기간 동안 노출됩니다.</li>
            <li>회사는 이용자 경험을 고려하여 동일 시간대 광고 노출 개수, 순환 노출 방식(로테이션) 등을 운영 정책에 따라 정할 수 있으며, 특정 위치의 "단독 노출"을 보장하는 상품이 아닌 한 이를 보장하지 않습니다.</li>
            <li>회사는 서비스 개편, 시스템 점검 등 불가피한 사유로 게재 위치·형태를 변경할 수 있으며, 이 경우 사전에 기관회원에게 통지합니다.</li>
          </ol>
        </>
      );

    case 'chapter6':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제6조 (요금 및 결제)</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
            <li>광고서비스 이용료는 상품별 가격 정책에 따르며, 부가가치세는 별도입니다.</li>
            <li>결제는 회사가 정한 방법(세금계산서 발행 후 계좌이체, 카드결제 등)으로 진행하며, 기관회원은 정산에 필요한 정보(담당 부서, 세금계산서 수신 이메일 등)를 정확히 제공하여야 합니다.</li>
            <li>원칙적으로 결제 완료 및 광고소재 심사 승인 후 게재가 개시됩니다.</li>
          </ol>
        </>
      );

    case 'chapter7':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제7조 (취소 및 환불)</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
            <li><strong>게재 개시 전 취소</strong>: 심사 승인 전 또는 게재 개시 전 기관회원의 요청으로 취소하는 경우, 결제대금 전액을 환불합니다.</li>
            <li><strong>게재 개시 후 취소</strong>: 게재가 개시된 이후 기관회원의 사정으로 중도 취소하는 경우, 이미 제공된 노출 기간·성과에 상응하는 금액을 공제한 후 잔여 금액을 환불합니다. 구체적인 공제 기준(일할 계산 등)은 상품별 안내에 따릅니다.</li>
            <li><strong>회사 사유로 인한 미게재·중단</strong>: 회사의 귀책사유(시스템 오류, 심사 지연 등)로 광고가 게재되지 못하거나 조기 중단된 경우, 해당 기간에 대해 전액 환불하거나 동일 가치의 노출 기간으로 보상합니다.</li>
            <li><strong>심사 반려</strong>: 광고소재가 제4조의 기준을 충족하지 못하여 최종 반려된 경우, 이미 결제한 금액은 전액 환불합니다.</li>
            <li><strong>제작물 포함 상품</strong>: 프리미엄 패키지 등 제작물(랜딩페이지, 카드뉴스 등)이 포함된 상품의 경우, 제작이 착수된 이후에는 실제 투입 공수에 상응하는 비용을 공제할 수 있습니다.</li>
          </ol>
        </>
      );

    case 'chapter8':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제8조 (성과 리포트 제공)</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
            <li>회사는 광고서비스 이용 기관회원에게 게재기간 종료 후 또는 상품 조건에 따라 정기적으로 성과 리포트를 제공합니다.</li>
            <li>성과 리포트에는 조회수, 클릭수, 저장수, 뉴스레터 오픈율·클릭률, 관심분야별 반응, 유입경로 등이 포함될 수 있으며, 상품 등급에 따라 제공 항목이 상이할 수 있습니다.</li>
            <li>성과 리포트의 수치는 회사의 자체 통계 시스템을 기준으로 산출되며, 제3자 분석 도구(GA 등)의 수치와 산출 방식 차이로 인해 다를 수 있습니다.</li>
          </ol>
        </>
      );

    case 'chapter9':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제9조 (기관회원의 의무)</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
            <li>기관회원은 광고소재의 내용에 대해 최종적인 법적 책임을 부담하며, 회사의 심사 통과가 내용의 적법성·정확성을 보증하는 것은 아닙니다.</li>
            <li>기관회원은 광고소재에 포함된 이미지, 문구, 로고 등에 대한 적법한 사용 권한을 보유하여야 하며, 제3자 권리 침해로 인한 분쟁 발생 시 이를 해결할 책임을 부담합니다.</li>
            <li>기관회원은 챌린지 모집기간 종료, 모집 마감, 시상 취소 등 광고 내용에 영향을 미치는 변경사항이 발생한 경우 지체 없이 회사에 통지하여야 합니다.</li>
          </ol>
        </>
      );

    case 'chapter10':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제10조 (회사의 면책)</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
            <li>회사는 광고서비스를 통해 유입된 참가자의 실제 지원·참여 여부, 참가자의 자격, 챌린지 결과에 대해 보증하지 않습니다.</li>
            <li>회사는 성과 리포트상의 수치가 기관회원이 기대한 성과(참가율, 매출 등)를 보장하지 않으며, 이를 이유로 한 손해배상 책임을 지지 않습니다.</li>
            <li>회사는 기관회원이 제공한 정보의 허위·오류로 인해 발생한 손해에 대해 책임을 지지 않습니다.</li>
          </ol>
        </>
      );

    case 'chapter11':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제11조 (계약 해지 및 제재)</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
            <li>회사는 기관회원이 다음 각 호에 해당하는 경우 사전 통지 후(긴급한 경우 사후 통지) 광고서비스 게재를 중단하거나 계약을 해지할 수 있습니다.
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>허위 챌린지 등록 또는 시상 불이행이 확인된 경우</li>
                <li>광고소재 심사 기준을 반복적으로 위반한 경우</li>
                <li>이용약관 또는 이 정책을 위반한 경우</li>
                <li>결제대금을 정당한 사유 없이 지급하지 않은 경우</li>
              </ul>
            </li>
            <li>제1항에 따라 계약이 해지되는 경우 미제공 게재기간에 대해서는 제7조의 환불 기준을 준용합니다.</li>
          </ol>
        </>
      );

    case 'chapter12':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제12조 (분쟁해결)</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            이 정책과 관련하여 발생하는 분쟁은 세모챌 이용약관 제32조(분쟁해결) 및 제33조(재판관할 및 준거법)를 따릅니다.
          </p>
        </>
      );

    case 'chapter13':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제13조 (정책의 개정)</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            회사는 관계 법령 및 서비스 운영상 필요에 따라 이 정책을 개정할 수 있으며, 개정 시 적용일자 7일 전(기관회원에게 불리한 경우 30일 전)부터 공지합니다.
          </p>

          <div className="mt-8 pt-6 border-t">
            <h3 className="font-medium text-gray-900 mb-2">부칙</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              이 정책은 20XX년 XX월 XX일부터 시행합니다.
            </p>
          </div>
        </>
      );

    default:
      return null;
  }
}
