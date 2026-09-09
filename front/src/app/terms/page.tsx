'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState('chapter1');

  const chapters = [
    { id: 'chapter1', title: '제1장 총칙', content: getChapterContent('chapter1') },
    { id: 'chapter2', title: '제2장 이용계약의 체결', content: getChapterContent('chapter2') },
    { id: 'chapter3', title: '제3장 계약당사자의 의무', content: getChapterContent('chapter3') },
    { id: 'chapter4', title: '제4장 서비스의 제공 및 변경', content: getChapterContent('chapter4') },
    { id: 'chapter5', title: '제5장 챌린지 참가 및 콘텐츠', content: getChapterContent('chapter5') },
    { id: 'chapter6', title: '제6장 기관회원(BIZ) 특칙', content: getChapterContent('chapter6') },
    { id: 'chapter7', title: '제7장 결제 및 환불', content: getChapterContent('chapter7') },
    { id: 'chapter8', title: '제8장 이용제한 및 계약해지', content: getChapterContent('chapter8') },
    { id: 'chapter9', title: '제9장 손해배상 및 면책', content: getChapterContent('chapter9') },
    { id: 'chapter10', title: '제10장 기타', content: getChapterContent('chapter10') },
  ];

  const notices = [
    {
      title: '⚠️ 검토 필요 안내 (사용 전 확인사항)',
      items: [
        '- **회사 정보**: 상호, 대표자명, 사업자등록번호, 주소, 고객센터 연락처/이메일 (전자상거래법상 필수 표시사항)',
        '- **개인정보처리방침**: 이 약관과 별도로 작성 필요 (개인정보보호법 제30조)',
        '- **청소년보호정책**: 청소년 이용자가 많은 서비스 특성상 별도 정책 수립 권장',
        '- **환불규정 세부안**: 유료 광고상품(추천 챌린지, 타깃 홍보 등)의 구체적 환불 기준표',
        '- **변호사 검토**: 본 문서는 참고용 초안이며, 법률 자문 없이 그대로 게시하지 않으시길 권장합니다.',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">세모챌 이용약관</h1>
          <p className="mt-2 text-sm text-gray-500">시행일자: 20XX년 XX월 XX일</p>
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
                    <Link href="/youth" className="block px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm text-gray-700">
                      청소년보호정책
                    </Link>
                    <Link href="/advertising" className="block px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm text-gray-700">
                      광고 운영정책
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
                본 이용약관은 대한민국 관련 법령을 준수하도록 작성되었습니다. 
                하지만 서비스의 구체적인 운영 정책, 상품 내용, 환불 기준 등에 따라 추가 조항이 필요할 수 있습니다.
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제1장 총칙</h2>
          
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제1조 (목적)</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              이 약관은 (주)OOO(이하 "회사")가 운영하는 공모전·대회 정보 및 참가 지원 플랫폼 "세모챌"(이하 "서비스")의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제2조 (정의)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>
                "서비스"란 회사가 제공하는 공모전·대회 정보 제공, AI 기반 챌린지 추천, 팀원 모집, 배지(성취 뱃지) 제공 등 세모챌이 제공하는 일체의 서비스를 의미합니다.
              </li>
              <li>
                "회원"이란 이 약관에 동의하고 회사와 이용계약을 체결하여 서비스를 이용하는 자로, 다음과 같이 구분합니다.
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li><strong>일반회원(User)</strong>: 공모전·대회에 참가하고자 하는 개인 회원</li>
                  <li><strong>기관회원(BIZ)</strong>: 공모전·대회를 주최·운영하고자 하는 기업, 학교, 단체, 협회, 공공기관 등의 회원</li>
                </ul>
              </li>
              <li>"챌린지(콘텐츠)"란 기관회원이 등록한 공모전, 대회, 공고 등의 정보를 의미합니다.</li>
              <li>"제출물"이란 일반회원이 챌린지 참가를 위해 서비스 내 또는 외부 링크를 통해 제출하는 작품, 서류, 콘텐츠 일체를 의미합니다.</li>
              <li>"팀원모집 게시물"이란 일반회원이 챌린지 참가를 위한 팀 구성을 목적으로 서비스 내에 게시하는 모집 공고를 의미합니다.</li>
              <li>"배지(Badge)"란 회원의 활동, 수상 이력, 신뢰도 등을 시각적으로 표시하기 위해 회사가 부여하는 인증 표식을 의미합니다.</li>
              <li>"AI 추천"이란 회원의 관심분야, 활동 이력 등을 기반으로 회사가 알고리즘을 통해 맞춤형 챌린지 정보를 제공하는 기능을 의미합니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제3조 (약관의 게시와 개정)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>회사는 이 약관의 내용을 회원이 쉽게 알 수 있도록 서비스 초기 화면 또는 연결화면에 게시합니다.</li>
              <li>회사는 「전자상거래 등에서의 소비자보호에 관한 법률」, 「약관의 규제에 관한 법률」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」등 관련 법령을 위반하지 않는 범위에서 이 약관을 개정할 수 있습니다.</li>
              <li>회사가 약관을 개정할 경우 적용일자 및 개정사유를 명시하여 적용일자 최소 7일 전(이용자에게 불리한 개정의 경우 30일 전)부터 적용일자 전일까지 공지합니다.</li>
              <li>회원이 개정약관의 적용에 동의하지 않는 경우 회원은 이용계약을 해지할 수 있으며, 공지 후 개정약관 시행일까지 이의를 제기하지 않는 경우 개정약관에 동의한 것으로 봅니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제4조 (약관 외 준칙)</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              이 약관에서 정하지 아니한 사항과 이 약관의 해석에 관하여는 전자상거래 등에서의 소비자보호에 관한 법률, 정보통신망 이용촉진 및 정보보호 등에 관한 법률, 약관의 규제에 관한 법률 등 관계 법령 및 회사가 정한 서비스별 별도 지침(운영정책)에 따릅니다.
            </p>
          </div>
        </>
      );

    case 'chapter2':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제2장 이용계약의 체결</h2>
          
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제5조 (이용신청)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>이용신청자는 회사가 정한 가입 양식에 따라 회원정보를 기입하고 이 약관에 동의함으로써 이용신청을 합니다.</li>
              <li>일반회원은 이름, 이메일, 휴대폰번호, 생년월일 등 개인 식별정보를 제공하여야 합니다.</li>
              <li>기관회원은 다음 각 호의 정보를 제공하여야 합니다.
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>기관 유형(일반기업/개인사업자, 비영리·민간단체, 학교·동아리·학생회, 협회, 공공기관·지자체 등)</li>
                  <li>사업자등록번호 또는 고유번호(10자리), 법인인 경우 법인등록번호</li>
                  <li>기관명, 대표자명, 사업장(단체) 주소</li>
                  <li>담당자 이름, 부서/직급, 이메일, 휴대폰번호</li>
                  <li>사업자등록증 또는 고유번호증 등 증빙서류(국세청 API 진위확인이 되지 않는 경우)</li>
                </ul>
              </li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제6조 (이용계약의 성립)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>이용계약은 이용신청자가 약관 내용에 동의하고 이용신청을 한 후, 회사가 이를 승낙함으로써 성립합니다.</li>
              <li>일반회원의 경우 원칙적으로 이용신청과 동시에 승낙이 이루어집니다.</li>
              <li>기관회원의 경우 회사는 사업자등록번호/고유번호에 대한 국세청 API 진위확인 또는 제출 서류 검토를 거쳐 승인 여부를 결정하며, 승인 전까지는 "가승인" 상태로 챌린지 등록 등 핵심 기능 이용이 제한될 수 있습니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제7조 (이용신청의 제한 및 보류)</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-2">회사는 다음 각 호에 해당하는 신청에 대하여는 승낙을 하지 않거나 사후에 이용계약을 해지할 수 있습니다.</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 leading-relaxed">
              <li>실명이 아니거나 타인의 명의를 이용한 경우</li>
              <li>허위의 정보를 기재하거나 회사가 요구하는 사항을 기재하지 않은 경우</li>
              <li>기관회원의 경우 사업자등록번호/고유번호가 확인되지 않거나 증빙서류가 진정하지 않은 경우</li>
              <li>만 14세 미만 아동이 법정대리인의 동의 없이 신청한 경우</li>
              <li>이전에 이 약관 위반 등을 이유로 이용계약이 해지된 이력이 있는 경우</li>
              <li>기타 회사가 정한 이용신청 요건을 충족하지 못한 경우</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제8조 (미성년자의 이용)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>만 14세 미만 아동이 서비스를 이용하고자 하는 경우 법정대리인의 동의를 얻어야 하며, 회사는 관련 법령에 따라 법정대리인의 동의 여부를 확인할 수 있습니다.</li>
              <li>미성년 회원이 유료서비스 등 법률행위를 하는 경우 법정대리인의 동의가 필요하며, 동의 없이 체결된 계약은 미성년자 본인 또는 법정대리인이 취소할 수 있습니다.</li>
            </ol>
          </div>
        </>
      );

    case 'chapter3':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제3장 계약당사자의 의무</h2>
          
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제9조 (회사의 의무)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>회사는 관련 법령과 이 약관이 금지하거나 미풍양속에 반하는 행위를 하지 않으며, 계속적이고 안정적으로 서비스를 제공하기 위해 노력합니다.</li>
              <li>회원은 회원의 개인정보를 관련 법령 및 개인정보처리방침에 따라 안전하게 처리합니다.</li>
              <li>회사는 서비스 이용과 관련하여 회원으로부터 제기된 의견이나 불만이 정당하다고 인정될 경우 이를 처리하여야 하며, 처리 과정을 회원에게 공지 또는 통지합니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제10조 (회원의 의무)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>회원은 관계 법령, 이 약관의 규정, 이용안내 및 서비스와 관련하여 공지한 주의사항, 회사가 통지하는 사항을 준수하여야 합니다.</li>
              <li>회원은 회원정보에 변경이 있는 경우 지체 없이 이를 수정하여야 하며, 미수정으로 인해 발생한 불이익에 대해 회사는 책임을 지지 않습니다.</li>
              <li>회원은 아이디 및 비밀번호 관리에 대한 책임을 지며, 이를 제3자에게 이용하게 해서는 안 됩니다.</li>
              <li>기관회원은 챌린지 등록 시 정확한 정보(모집기간, 참가자격, 시상내역, 심사기준 등)를 게시하여야 하며, 허위·과장된 정보를 게시해서는 안 됩니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제11조 (금지행위)</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-2">회원은 다음 각 호의 행위를 하여서는 안 됩니다.</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 leading-relaxed">
              <li>타인의 정보를 도용하거나 허위 정보를 등록하는 행위</li>
              <li>서비스를 이용하여 얻은 정보를 회사의 사전 승낙 없이 복제, 유통, 조장하거나 상업적으로 이용하는 행위</li>
              <li>회사 또는 제3자의 저작권 등 지식재산권을 침해하는 행위</li>
              <li>회사 또는 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
              <li>외설 또는 폭력적인 메시지, 화상, 음성 기타 공서양속에 반하는 정보를 서비스에 공개 또는 게시하는 행위</li>
              <li>팀원모집 게시물을 이용하여 서비스 목적과 무관한 영리 활동, 다단계, 유사수신 등을 홍보하는 행위</li>
              <li>AI 추천, 배지 등 시스템을 부정한 방법으로 조작하거나 어뷰징하는 행위</li>
              <li>기관회원이 실제 존재하지 않거나 이행 의사가 없는 허위 챌린지를 등록하는 행위</li>
              <li>기타 불법적이거나 부당한 행위</li>
            </ol>
          </div>
        </>
      );

    case 'chapter4':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제4장 서비스의 제공 및 변경</h2>
          
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제12조 (서비스의 내용)</h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-2">회사가 제공하는 서비스는 다음과 같습니다.</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 leading-relaxed">
              <li>공모전·대회 정보의 게시 및 검색 서비스</li>
              <li>회원의 관심분야, 활동이력 등을 기반으로 한 AI 챌린지 추천 서비스</li>
              <li>챌린지 참가를 위한 팀원모집 게시판 서비스</li>
              <li>회원의 활동·수상·인증 이력에 따른 배지(뱃지) 부여 서비스</li>
              <li>기관회원을 위한 챌린지 등록·심사관리·지원자 관리 서비스</li>
              <li>기관회원을 위한 유료 광고·노출 상품(추천 챌린지, 타깃 홍보, 프리미엄 패키지 등)</li>
              <li>기타 회사가 추가 개발하거나 제휴를 통해 회원에게 제공하는 일체의 서비스</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제13조 (AI 추천 서비스에 관한 특칙)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>AI 추천 서비스는 회원이 입력하거나 서비스 이용 과정에서 수집된 정보를 기반으로 알고리즘에 따라 자동 산출된 결과이며, 회사는 추천 결과의 완전성, 정확성을 보장하지 않습니다.</li>
              <li>회원은 AI 추천 결과를 참고자료로 활용하여야 하며, 이를 유일한 근거로 한 의사결정에 대하여 회사는 책임을 지지 않습니다.</li>
              <li>회사는 관련 법령이 정하는 경우 AI 추천 로직의 주요 기준을 회원에게 고지합니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제14조 (팀원모집 게시물에 관한 특칙)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>팀원모집 게시물의 작성, 게시 및 이를 통한 팀 구성 과정에서 발생하는 회원 간의 약속, 역할 분담, 결과물에 대한 권리관계는 게시자와 지원자 간에 자율적으로 정하며, 회사는 이에 대한 당사자가 아닙니다.</li>
              <li>회사는 팀원모집 과정에서 발생하는 회원 간 분쟁에 대하여 관여할 의무가 없으며, 다만 회원 보호를 위해 필요한 경우 중재를 지원할 수 있습니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제15조 (배지 제도에 관한 특칙)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>배지는 회원의 서비스 내 활동, 수상 이력, 활동 인증 등 회사가 정한 기준에 따라 부여되며, 법적 자격이나 공인된 인증을 의미하지 않습니다.</li>
              <li>회사는 배지 부여 기준을 변경할 수 있으며, 부정한 방법으로 취득한 배지는 사전 통지 후 회수할 수 있습니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제16조 (서비스의 변경 및 중단)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>회사는 운영상, 기술상의 필요에 따라 제공하는 서비스의 전부 또는 일부를 변경할 수 있으며, 이 경우 변경 사유와 내용, 제공일자를 사전에 공지합니다.</li>
              <li>회사는 천재지변, 시스템 점검, 국가비상사태 등 부득이한 사유가 있는 경우 서비스 제공을 일시적으로 중단할 수 있으며, 이 경우 사전 또는 사후에 이를 공지합니다.</li>
              <li>회사는 무료로 제공되는 서비스 일부 또는 전부를 회사의 정책 및 운영 필요상 수정, 중단, 변경할 수 있으며, 이에 대해 관련 법령에 특별한 규정이 없는 한 회원에게 별도의 보상을 하지 않습니다.</li>
            </ol>
          </div>
        </>
      );

    case 'chapter5':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제5장 챌린지 참가 및 콘텐츠</h2>
          
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제17조 (챌린지 참가)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>일반회원은 서비스에 게시된 챌린지에 대해 각 챌린지의 참가자격 및 절차에 따라 참가를 신청할 수 있습니다.</li>
              <li>챌린지 참가와 관련한 모집기간, 참가자격, 제출방법, 심사기준, 시상내역 등 구체적인 조건은 각 기관회원이 정하며, 이에 대한 책임은 원칙적으로 해당 기관회원에게 있습니다.</li>
              <li>회사는 챌린지 정보의 매개·중개자로서 챌린지의 진행, 심사결과, 시상 이행 등에 대하여 보증하지 않습니다. 다만 허위 챌린지, 이행 의사 없는 챌린지로 확인된 경우 회사는 해당 콘텐츠를 삭제하고 등록 기관회원의 이용을 제한할 수 있습니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제18조 (제출물의 권리)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>제출물에 대한 저작권 등 지식재산권은 원칙적으로 이를 창작한 일반회원에게 귀속됩니다.</li>
              <li>제출물의 활용범위(주최기관의 사용 허락 범위 등)는 각 챌린지 공고 및 참가자-기관회원 간 별도 약정에 따르며, 회사는 그 이행에 관여하지 않습니다.</li>
              <li>회원은 서비스 내 콘텐츠 게시와 관련하여 회사가 서비스의 운영, 홍보, 개선을 위해 필요한 범위 내에서 해당 콘텐츠를 무상으로 사용(복제, 전시, 전송 등)할 수 있도록 허락합니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제19조 (콘텐츠의 관리)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>회원이 게시한 게시물이 관계 법령 및 이 약관에 위반되는 경우 회사는 관련 법령에 따라 해당 게시물에 대해 접근 차단 등 임시조치를 취할 수 있습니다.</li>
              <li>권리를 침해받았다고 주장하는 자는 회사에 침해사실 소명자료를 제출하여 게시중단 등을 요청할 수 있으며, 회사는 관련 법령에 따라 처리합니다.</li>
            </ol>
          </div>
        </>
      );

    case 'chapter6':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제6장 기관회원(BIZ) 특칙</h2>
          
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제20조 (기관회원의 지위)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>기관회원은 서비스를 통해 챌린지를 등록·운영하는 주체로서, 등록한 챌린지의 내용, 진행, 시상 이행에 대한 책임을 부담합니다.</li>
              <li>기관회원은 사업자등록번호/고유번호 등 가입 정보에 변경이 발생한 경우 지체 없이 회사에 통지하고 정보를 수정하여야 합니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제21조 (기관회원 검증)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>회사는 국세청 사업자등록정보 진위확인 API 등을 통해 기관회원의 사업자등록번호 또는 고유번호의 진위 및 휴폐업 여부를 확인할 수 있습니다.</li>
              <li>API 로 확인되지 않는 임의단체(학생회, 동아리 등)의 경우 회사가 요청하는 증빙서류(재학증명서, 학교 공문 등) 제출을 통해 별도 심사를 진행하며, 승인 전까지 챌린지 등록 등 핵심 기능이 제한됩니다.</li>
              <li>회사는 검증 결과 허위 또는 정보 불일치가 확인되는 경우 승인을 거부하거나 이용계약을 해지할 수 있습니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제22조 (유료서비스 및 광고상품)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>회사는 기관회원을 대상으로 챌린지 노출 강화, 타깃 홍보, 프리미엄 패키지, 운영대행 연계 등 유료 상품을 제공할 수 있으며, 상품별 가격, 제공 범위는 별도 페이지에 게시합니다.</li>
              <li>유료서비스 이용에 관한 결제, 청약철회, 환불 등은 제7장(결제 및 환불)의 규정에 따릅니다.</li>
              <li>성과 리포트(조회수, 클릭수, 저장수, 뉴스레터 오픈율 등)는 회사가 보유한 통계 데이터를 기반으로 제공되며, 산출 방식은 회사의 정책에 따라 변경될 수 있습니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제23조 (기관회원의 콘텐츠 관리 책임)</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              기관회원은 등록하는 챌린지 정보, 광고 콘텐츠가 관계 법령(표시광고법, 청소년보호법 등) 및 이 약관을 준수하도록 관리할 책임이 있으며, 이를 위반하여 발생하는 모든 민형사상 책임은 해당 기관회원이 부담합니다.
            </p>
          </div>
        </>
      );

    case 'chapter7':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제7장 결제 및 환불</h2>
          
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제24조 (결제)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>유료서비스의 결제는 회사가 정한 방법(신용카드, 계좌이체 등)으로 이루어지며, 기관회원은 세금계산서 수신 이메일 등 정산에 필요한 정보를 제공하여야 합니다.</li>
              <li>회사는 결제 완료 시 관련 법령에 따라 결제내역을 확인할 수 있는 자료를 제공합니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제25조 (청약철회 및 환불)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>회원은 유료서비스 결제 후 관련 법령이 정하는 바에 따라 청약철회를 할 수 있습니다. 다만 서비스 제공이 개시된 경우(예: 챌린지 노출이 시작된 경우) 등 관련 법령에서 정하는 청약철회 제한 사유에 해당하는 경우 청약철회가 제한될 수 있습니다.</li>
              <li>환불금액 산정 및 절차는 회사가 정한 별도 정책(환불규정)에 따르며, 해당 규정은 관련 법령을 위반하지 않는 범위 내에서 정합니다.</li>
            </ol>
          </div>
        </>
      );

    case 'chapter8':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제8장 이용제한 및 계약해지</h2>
          
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제26조 (이용제한)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>회사는 회원이 이 약관의 의무를 위반하거나 서비스의 정상적인 운영을 방해한 경우, 경고, 일시정지, 영구이용정지 등으로 서비스 이용을 단계적으로 제한할 수 있습니다.</li>
              <li>회사는 부정 이용, 어뷰징, 허위 챌린지 등록 등 서비스 운영을 심각하게 저해하는 행위에 대해서는 사전 통지 없이 즉시 이용을 제한할 수 있습니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제27조 (계약해지)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>회원은 언제든지 서비스 내 회원탈퇴 기능을 통해 이용계약을 해지할 수 있습니다.</li>
              <li>회사는 회원이 이 약관을 위반하거나 관계 법령을 위반한 경우 사전 통지 후 이용계약을 해지할 수 있습니다. 다만 긴급하게 조치할 필요가 있는 경우 사후에 통지할 수 있습니다.</li>
              <li>계약 해지 시 회원의 개인정보는 개인정보처리방침 및 관계 법령에 따라 처리됩니다.</li>
            </ol>
          </div>
        </>
      );

    case 'chapter9':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제9장 손해배상 및 면책</h2>
          
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제28조 (손해배상)</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              회사 또는 회원이 이 약관을 위반하여 상대방에게 손해를 입힌 경우, 그 위반한 당사자는 상대방에게 발생한 손해를 배상할 책임이 있습니다.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제29조 (면책조항)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>회사는 천재지변, 국가비상사태 등 불가항력으로 인하여 서비스를 제공할 수 없는 경우 책임이 면제됩니다.</li>
              <li>회사는 회원 간 또는 회원과 제3자 간에 서비스를 매개로 발생한 분쟁(예: 챌린지 시상 미이행, 팀원모집을 통한 약속 불이행 등)에 대하여 개입할 의무가 없으며, 이로 인한 손해에 대해 책임을 지지 않습니다. 다만 회사의 고의 또는 중대한 과실이 있는 경우는 예외로 합니다.</li>
              <li>회사는 회원이 서비스를 통해 기대하는 수익이나 이익을 얻지 못한 것에 대하여 책임을 지지 않습니다.</li>
              <li>회사는 무료로 제공되는 서비스 이용과 관련하여 관계법령에 특별한 규정이 없는 한 책임을 지지 않습니다.</li>
            </ol>
          </div>
        </>
      );

    case 'chapter10':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제10장 기타</h2>
          
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제30조 (개인정보보호)</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              회사는 관계 법령이 정하는 바에 따라 회원의 개인정보를 보호하기 위해 노력하며, 개인정보의 수집·이용·보관·파기 등에 관한 사항은 별도의 「개인정보처리방침」에 따릅니다.
            </p>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제31조 (회원에 대한 통지)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>회사가 회원에 대한 통지를 하는 경우 회원이 등록한 이메일, 서비스 내 알림, SMS 등으로 할 수 있습니다.</li>
              <li>불특정다수 회원에 대한 통지는 7 일 이상 서비스 내 게시판에 게시함으로써 개별 통지를 갈음할 수 있습니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제32조 (분쟁해결)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>회사는 회원이 제기하는 정당한 의견이나 불만을 반영하고, 그 피해를 보상처리하기 위해 고객센터를 운영합니다.</li>
              <li>회사와 회원 간에 발생한 분쟁과 관련하여 회원은 관계 법령이 정하는 분쟁조정기관(예: 전자거래분쟁조정위원회, 콘텐츠분쟁조정위원회 등)에 조정을 신청할 수 있습니다.</li>
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">제33조 (재판관할 및 준거법)</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
              <li>회사와 회원 간 발생한 분쟁에 관한 소송은 제소 당시 회원의 주소에 의하고, 주소가 없는 경우에는 거소를 관할하는 지방법원의 전속관할로 합니다. 다만 제소 당시 회원의 주소 또는 거소가 분명하지 않거나 외국 거주자의 경우 민사소송법상 관할법원에 제기합니다.</li>
              <li>회사와 회원 간에 제기된 소송에는 대한민국 법을 적용합니다.</li>
            </ol>
          </div>

          <div className="mt-8 pt-6 border-t">
            <h3 className="font-medium text-gray-900 mb-2">부칙</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              이 약관은 20XX년 XX월 XX일부터 시행합니다.
            </p>
          </div>
        </>
      );

    default:
      return null;
  }
}
