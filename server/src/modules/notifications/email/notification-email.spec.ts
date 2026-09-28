import { describe, expect, it } from 'vitest';
import { parseNotificationEmailJob } from './notification-email.js';
import { renderNotificationEmail } from './notification-email.templates.js';

describe('parseNotificationEmailJob', () => {
  it('accepts the relay envelope', () => {
    expect(
      parseNotificationEmailJob({ eventId: 'e-1', payload: { notificationId: 'n-1' } }),
    ).toEqual({ eventId: 'e-1', payload: { notificationId: 'n-1' } });
  });

  it.each([
    null,
    {},
    { eventId: 'e-1' },
    { eventId: 1, payload: { notificationId: 'n-1' } },
    {
      eventId: 'e-1',
      payload: {},
    },
  ])('rejects malformed body %j', (body) => {
    expect(parseNotificationEmailJob(body)).toBeNull();
  });
});

describe('renderNotificationEmail', () => {
  const origin = 'https://semochall.example/';

  it.each([
    ['verification.result', { status: 'verified' }, '승인되었습니다'],
    ['verification.result', { status: 'approved' }, '승인되었습니다'],
    ['verification.result', { status: 'rejected' }, '결과를 확인해 주세요'],
    ['team_matching', { teamId: 't', applicantUserId: 'u' }, '새 팀 참여 신청'],
    ['team_matching', { teamId: 't', status: 'accepted' }, '수락되었습니다'],
    ['team_matching', { teamId: 't', status: 'rejected' }, '결과를 확인해 주세요'],
  ])('renders %s %j with text and html bodies', (type, payload, subject) => {
    const email = renderNotificationEmail(type, payload, origin);
    expect(email?.subject).toContain(subject);
    expect(email?.subject.startsWith('[세모챌]')).toBe(true);
    expect(email?.text).toContain('https://semochall.example/notifications');
    expect(email?.html).toContain('href="https://semochall.example/notifications"');
  });

  it('returns null for types that are not emailed', () => {
    expect(renderNotificationEmail('report.resolved', {}, origin)).toBeNull();
    expect(renderNotificationEmail('team_matching', { teamId: 't' }, origin)).toBeNull();
  });

  it('never includes free-text payload fields such as rejection reasons', () => {
    const email = renderNotificationEmail(
      'verification.result',
      { status: 'rejected', reason: '<b>사업자번호 123-45-67890 불일치</b>' },
      origin,
    );
    expect(email?.text).not.toContain('123-45-67890');
    expect(email?.html).not.toContain('123-45-67890');
  });

  it('escapes the link in HTML', () => {
    const email = renderNotificationEmail('team_matching', { status: 'accepted' }, 'https://x/"a');
    expect(email?.html).toContain('https://x/&quot;a/notifications');
  });
});
