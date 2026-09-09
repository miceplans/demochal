'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function YouthPolicyPage() {
  const [activeSection, setActiveSection] = useState('chapter1');

  const chapters = [
    { id: 'chapter1', title: '제1조 (목적)', content: getChapterContent('chapter1') },
    { id: 'chapter2', title: '제2조 (청소년의 정의)', content: getChapterContent('chapter2') },
    { id: 'chapter3', title: '제3조 (청소년보호책임자의 지정)', content: getChapterContent('chapter3') },
    { id: 'chapter4', title: '제4조 (청소년유해정보에 대한 관리 방침)', content: getChapterContent('chapter4') },
    { id: 'chapter5', title: '제5조 (청소년의 회원가입 및 이용 제한)', content: getChapterContent('chapter5') },
    { id: 'chapter6', title: '제6조 (기관회원의 청소년 보호 의무)', content: getChapterContent('chapter6') },
    { id: 'chapter7', title: '제7조 (청소년 유해매체물 및 광고 제한)', content: getChapterContent('chapter7') },
    { id: 'chapter8', title: '제8조 (상담 및 고충처리)', content: getChapterContent('chapter8') },
    { id: 'chapter9', title: '제9조 (교육 및 협력)', content: getChapterContent('chapter9') },
    { id: 'chapter10', title: '제10조 (정책의 개정)', content: getChapterContent('chapter10') },
  ];

  const notices = [
    {
      title: '⚠️ 검토 필요 안내',
      items: [
        '- **청소년보호책임자 실제 정보**(성명/소속/연락처)로 교체 필요 — 정보통신망법상 웹사이트 하단에 청소년보호책임자 성명·직위·연락처 게시 의무 있음',
        '- 세모챌은 대학생·고등학생 대외활동 참가자 비중이 높을 것으로 예상되므로, **팀원모집 게시물 내 개인연락처 노출/오프라인 만남 유도** 관련 모니터링 정책을 실제 운영 프로세스(신고 버튼, 자동 필터링 키워드 등)와 연결해 구체화하는 것을 권장합니다.',
        '- 실제 서비스 내 **신고 기능 UI/프로세스**가 구축되면 제8조 절차와 일치시켜 업데이트해 주세요.',
        '- 법률 검토 없이 그대로 게시하지 마시고, 전자상거래법·정보통신망법 최신 개정사항 반영 여부를 자문받으시길 권장합니다.',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">세모챌 청소년보호정책</h1>
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
                    <Link href="/terms" className="block px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm text-gray-700">
                      이용약관
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
                본 청소년보호정책은 대한민국 관련 법령(정보통신망법, 청소년보호법 등)을 준수하도록 작성되었습니다. 
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
            이 정책은 회사가 운영하는 서비스 "세모챌" 내에서 청소년이 유해한 정보에 노출되는 것을 방지하고, 건전한 서비스 이용 환경을 조성하기 위한 기준과 조치사항을 정함을 목적으로 합니다.
          </p>
        </>
      );

    case 'chapter2':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제2조 (청소년의 정의)</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            이 정책에서 "청소년"이라 함은 「청소년보호법」에 따라 만 19세 미만인 자(다만 만 19세가 되는 해의 1월 1일을 맞이한 자는 제외)를 말합니다.
          </p>
        </>
      );

    case 'chapter3':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제3조 (청소년보호책임자의 지정)</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
            <li>회사는 서비스 내 청소년유해정보로부터 청소년을 보호하고 관련 고충을 처리하기 위하여 청소년보호책임자를 지정합니다.</li>
            <li>청소년보호책임자 정보는 다음과 같습니다.
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>성명: OOO</li>
                <li>소속/직위: OOO팀 / OOO</li>
                <li>이메일: youth@semochal.com (예시, 실제 주소로 교체 필요)</li>
                <li>전화번호: 02-OOO-OOOO (예시, 실제 번호로 교체 필요)</li>
              </ul>
            </li>
            <li>청소년보호책임자는 청소년유해정보로 인한 피해상담 및 고충처리, 청소년유해정보에 대한 모니터링을 담당합니다.</li>
          </ol>
        </>
      );

    case 'chapter4':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제4조 (청소년유해정보에 대한 관리 방침)</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
            <li>회사는 다음 각 호에 해당하는 정보가 서비스 내에 게시·유통되지 않도록 관리합니다.
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>음란물, 폭력적·선정적 표현 등 청소년에게 유해한 매체물</li>
                <li>도박, 사행성 조장 정보</li>
                <li>마약류, 유해약물 등의 사용을 조장하거나 매매를 알선하는 정보</li>
                <li>자살, 자해를 미화하거나 방법을 안내하는 정보</li>
                <li>청소년에 대한 성적 착취, 그루밍 등을 목적으로 하는 접촉 시도</li>
                <li>학교폭력, 따돌림 등을 조장하는 정보</li>
                <li>그 밖에 청소년의 정신적·신체적 건강을 해칠 우려가 있는 정보</li>
              </ul>
            </li>
            <li>회사는 이용자가 게시하는 챌린지 정보, 팀원모집 게시물, 후기 등 콘텐츠에 대해 자동 필터링 및 운영진 모니터링을 실시하며, 제1항에 해당하는 게시물을 발견한 경우 삭제, 접근제한 등 필요한 조치를 취합니다.</li>
            <li>회사는 이용자 신고 기능을 통해 청소년유해정보를 즉시 신고할 수 있도록 하며, 접수된 신고는 지체 없이 확인·처리합니다.</li>
          </ol>
        </>
      );

    case 'chapter5':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제5조 (청소년의 회원가입 및 이용 제한)</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
            <li>만 14세 미만 아동이 서비스에 가입하고자 하는 경우 법정대리인의 동의를 받아야 하며, 회사는 관련 절차를 마련하여 동의 여부를 확인합니다.</li>
            <li>회사는 다음과 같이 청소년의 안전한 이용을 위한 조치를 취합니다.
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>유료 결제 기능 이용 시 만 19세 미만 이용자에 대해서는 법정대리인 동의 절차를 적용</li>
                <li>기관회원(공모전 주최기관)이 등록하는 챌린지 중 청소년 참가가 부적절한 내용(성인 대상 공모전, 유해 상금 등)이 포함된 경우 청소년의 참가신청을 제한하거나 별도 고지</li>
                <li>팀원모집 게시물을 통한 오프라인 만남 유도, 개인 연락처 요구 등 청소년 대상 위험행위에 대한 모니터링 강화</li>
              </ul>
            </li>
          </ol>
        </>
      );

    case 'chapter6':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제6조 (기관회원의 청소년 보호 의무)</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
            <li>기관회원은 챌린지를 등록·운영함에 있어 청소년 참가자를 대상으로 하는 경우 참가자격, 개인정보 수집 범위, 시상 방식 등이 청소년보호법 및 관계 법령에 부합하도록 하여야 합니다.</li>
            <li>기관회원은 청소년 참가자와의 소통 과정에서 부적절한 사적 연락, 만남 요구 등을 하여서는 안 되며, 이를 위반한 경우 회사는 해당 기관회원의 이용을 제한할 수 있습니다.</li>
          </ol>
        </>
      );

    case 'chapter7':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제7조 (청소년 유해매체물 및 광고 제한)</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
            <li>회사는 서비스 내 배너, 추천 챌린지 등 광고 상품에 「청소년보호법」상 청소년유해매체물 또는 청소년에게 부적절한 광고(도박, 성인용품, 대출/사행성 등)가 노출되지 않도록 사전 심사합니다.</li>
            <li>AI 추천 알고리즘은 청소년 이용자에게 연령에 부적합한 챌린지·광고가 우선 노출되지 않도록 설계·운영합니다.</li>
          </ol>
        </>
      );

    case 'chapter8':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제8조 (상담 및 고충처리)</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 leading-relaxed">
            <li>청소년 이용자 또는 법정대리인은 서비스 이용 중 발견한 유해정보, 부적절한 접촉 등에 대해 제3조의 청소년보호책임자 또는 고객센터를 통해 상담·신고할 수 있습니다.</li>
            <li>회사는 접수된 사항에 대해 신속히 조사하고 필요한 조치(게시물 삭제, 이용제한, 수사기관 신고 등)를 취하며, 처리 결과를 신고자에게 통지합니다.</li>
            <li>성범죄, 그루밍 등 아동·청소년 대상 범죄가 의심되는 경우 회사는 관계 법령에 따라 즉시 수사기관에 신고합니다.</li>
          </ol>
        </>
      );

    case 'chapter9':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제9조 (교육 및 협력)</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            회사는 청소년보호를 위해 임직원 대상 교육을 실시하며, 방송통신심의위원회, 한국인터넷진흥원 등 관계 기관과 협력하여 청소년유해정보 차단 및 신고체계를 운영합니다.
          </p>
        </>
      );

    case 'chapter10':
      return (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">제10조 (정책의 개정)</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            이 정책은 관계 법령 개정 또는 회사 정책 변경에 따라 수정될 수 있으며, 개정 시 서비스 내 공지사항을 통해 사전 고지합니다.
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
