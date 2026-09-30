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
  pageBg: '#f4f4f4',
  cardBorder: '#dfe2e7',
  title: '#101010',
  body: '#636c7f',
  muted: '#858a99',
  onBrand: '#ffffff',
} as const;
const FONT = "-apple-system,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";

// 메일 클라이언트 호환을 위해 <table> + 인라인 스타일만 사용한다(flex/grid/<style> 금지).
function compose(subject: string, lines: string[], link: string): RenderedEmail {
  const footer = `본 메일은 ${SERVICE_NAME} 서비스 이용에 따른 안내 메일이며 발신 전용입니다.`;
  const notice = '알림의 자세한 내용은 사이트에 로그인해서 확인해 주세요.';
  const text = [...lines, '', notice, `확인하기: ${link}`, '', footer].join('\n');
  const href = escapeHtml(link);
  const html = [
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>`,
    `<body style="margin:0;padding:0;background:${COLOR.pageBg};font-family:${FONT}">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.pageBg};padding:24px 12px"><tr><td align="center">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">`,
    `<tr><td align="center" style="padding:0 0 16px;font-size:22px;font-weight:700;color:${COLOR.brand}">${escapeHtml(SERVICE_NAME)}</td></tr>`,
    `<tr><td style="background:#ffffff;border:1px solid ${COLOR.cardBorder};border-radius:16px;padding:32px 28px">`,
    `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;color:${COLOR.title}">${escapeHtml(subject)}</h1>`,
    ...lines.map(
      (line) =>
        `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${COLOR.body}">${escapeHtml(line)}</p>`,
    ),
    `<p style="margin:16px 0 24px;font-size:13px;line-height:1.6;color:${COLOR.muted}">${escapeHtml(notice)}</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td align="center" style="background:${COLOR.brand};border-radius:8px">`,
    `<a href="${href}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;color:${COLOR.onBrand};text-decoration:none">알림 확인하기</a>`,
    `</td></tr></table>`,
    `</td></tr>`,
    `<tr><td align="center" style="padding:16px 8px 0;font-size:12px;line-height:1.6;color:${COLOR.muted}">${escapeHtml(footer)}</td></tr>`,
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
  const link = `${frontendOrigin.replace(/\/+$/, '')}/notifications`;

  if (type === 'verification.result') {
    const approved = payload.status === 'verified' || payload.status === 'approved';
    return approved
      ? compose(
          '사업자 인증이 승인되었습니다',
          ['사업자 인증이 완료되어 승인되었습니다.', '이제 비즈니스 기능을 이용하실 수 있습니다.'],
          link,
        )
      : compose(
          '사업자 인증 결과를 확인해 주세요',
          ['사업자 인증이 승인되지 않았습니다.', '알림에서 상세 상태를 확인해 주세요.'],
          link,
        );
  }

  if (type === 'team_matching') {
    if (typeof payload.applicantUserId === 'string') {
      return compose(
        '새 팀 참여 신청이 도착했습니다',
        ['운영 중인 팀에 새 참여 신청이 도착했습니다.'],
        link,
      );
    }
    if (payload.status === 'accepted') {
      return compose('팀 참여 신청이 수락되었습니다', ['신청하신 팀 참여가 수락되었습니다.'], link);
    }
    if (payload.status === 'rejected') {
      return compose(
        '팀 참여 신청 결과를 확인해 주세요',
        ['신청하신 팀 참여가 수락되지 않았습니다.'],
        link,
      );
    }
  }

  return null;
}
