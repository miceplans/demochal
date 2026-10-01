export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const SERVICE_NAME = '세모챌';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// docs/design-tokens.md 값. 이메일 클라이언트는 CSS 변수를 지원하지 않아 hex로 옮겨 둔다.
const COLOR = {
  brand: '#006fff',
  pageBg: '#ffffff',
  boxBg: '#f4f4f4',
  title: '#101010',
  muted: '#858a99',
  onBrand: '#ffffff',
} as const;
const FONT = "-apple-system,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";

// 로고는 프론트 public 자산(/assets)을 프론트 origin으로 참조한다. 비즈니스 계정 알림은 SEMO.BIZ.
type EmailBrand = 'semo' | 'biz';
const LOGO: Record<EmailBrand, { path: string; alt: string; width: number }> = {
  semo: { path: '/assets/SEMO.png', alt: 'SEMO', width: 110 },
  biz: { path: '/assets/SEMOBIZ.png', alt: 'SEMO.BIZ', width: 150 },
};

// 메일 클라이언트 호환을 위해 <table> + 인라인 스타일만 사용한다(flex/grid/<style> 금지).
function compose(
  subject: string,
  lines: string[],
  origin: string,
  brand: EmailBrand = 'semo',
): RenderedEmail {
  const link = `${origin}/notifications`;
  const footer = `본 메일은 ${SERVICE_NAME} 서비스 이용에 따른 안내 메일이며 발신 전용입니다.`;
  const notice = '알림의 자세한 내용은 사이트에 로그인해서 확인해 주세요.';
  const text = [...lines, '', notice, `확인하기: ${link}`, '', footer].join('\n');
  const href = escapeHtml(link);
  const logo = LOGO[brand];
  const html = [
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>`,
    `<body style="margin:0;padding:0;background:${COLOR.pageBg};font-family:${FONT}">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.pageBg};padding:32px 12px"><tr><td align="center">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">`,
    `<tr><td align="center" style="padding:0 0 20px"><img src="${escapeHtml(origin + logo.path)}" alt="${logo.alt}" width="${logo.width}" style="display:block;border:0;height:auto;width:${logo.width}px"></td></tr>`,
    `<tr><td style="background:${COLOR.boxBg};border-radius:16px;padding:24px 28px">`,
    ...lines.map(
      (line, i) =>
        `<p style="margin:${i === 0 ? 0 : 6}px 0 0;font-size:18px;line-height:1.6;color:${COLOR.title}">${escapeHtml(line)}</p>`,
    ),
    `</td></tr>`,
    `<tr><td align="center" style="padding:20px 0 24px;font-size:13px;line-height:1.6;color:${COLOR.muted}">${escapeHtml(notice)}</td></tr>`,
    `<tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="background:${COLOR.brand};border-radius:12px">`,
    `<a href="${href}" style="display:inline-block;padding:16px 40px;font-size:16px;font-weight:700;color:${COLOR.onBrand};text-decoration:none">알림 확인하기</a>`,
    `</td></tr></table></td></tr>`,
    `<tr><td align="center" style="padding:32px 8px 0;font-size:12px;line-height:1.6;color:${COLOR.muted}">${escapeHtml(footer)}</td></tr>`,
    `</table></td></tr></table></body></html>`,
  ].join('');
  return { subject: `[${SERVICE_NAME}] ${subject}`, text, html };
}

/**
 * Renders a service email from an existing notification row. Uses only the
 * notification's own display data — never registration numbers, OCR results
 * or free-text reasons — and returns null for types that are not emailed.
 */
export function renderNotificationEmail(
  type: string,
  payload: Record<string, unknown>,
  frontendOrigin: string,
): RenderedEmail | null {
  const origin = frontendOrigin.replace(/\/+$/, '');

  if (type === 'verification.result') {
    const approved = payload.status === 'verified' || payload.status === 'approved';
    return approved
      ? compose(
          '사업자 인증이 승인되었습니다',
          ['사업자 인증이 완료되어 승인되었습니다.', '이제 비즈니스 기능을 이용하실 수 있습니다.'],
          origin,
          'biz',
        )
      : compose(
          '사업자 인증 결과를 확인해 주세요',
          ['사업자 인증이 승인되지 않았습니다.', '알림에서 상세 상태를 확인해 주세요.'],
          origin,
          'biz',
        );
  }

  if (type === 'team_matching') {
    if (typeof payload.applicantUserId === 'string') {
      return compose(
        '새 팀 참여 신청이 도착했습니다',
        ['운영 중인 팀에 새 참여 신청이 도착했습니다.'],
        origin,
      );
    }
    if (payload.status === 'accepted') {
      return compose(
        '팀 참여 신청이 수락되었습니다',
        ['신청하신 팀 참여가 수락되었습니다.'],
        origin,
      );
    }
    if (payload.status === 'rejected') {
      return compose(
        '팀 참여 신청 결과를 확인해 주세요',
        ['신청하신 팀 참여가 수락되지 않았습니다.'],
        origin,
      );
    }
  }

  return null;
}
