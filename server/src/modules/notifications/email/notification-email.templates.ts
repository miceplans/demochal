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

function compose(subject: string, lines: string[], link: string): RenderedEmail {
  const footer = `본 메일은 ${SERVICE_NAME} 서비스 이용에 따른 안내 메일이며 발신 전용입니다.`;
  const text = [...lines, '', `확인하기: ${link}`, '', footer].join('\n');
  const html = [
    '<!doctype html><html lang="ko"><body style="font-family:sans-serif;line-height:1.6">',
    ...lines.map((line) => `<p>${escapeHtml(line)}</p>`),
    `<p><a href="${escapeHtml(link)}">알림 확인하기</a></p>`,
    `<p style="color:#888;font-size:12px">${escapeHtml(footer)}</p>`,
    '</body></html>',
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
