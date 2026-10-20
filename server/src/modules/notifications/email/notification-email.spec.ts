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

  it('renders a card layout with a CTA button and inline styles only', () => {
    const email = renderNotificationEmail('verification.result', { status: 'verified' }, origin);
    expect(email?.html).toContain('<table');
    expect(email?.html).toMatch(
      /<a href="https:\/\/semochall\.example\/notifications"[^>]*>알림 확인하기<\/a>/,
    );
    expect(email?.html).toContain('src="https://semochall.example/assets/SEMOBIZ.png"');
    expect(email?.html).not.toContain('<style');
    expect(email?.text).toContain('사이트에 로그인해서 확인');
  });

  it('uses the SEMO logo for non-business notifications', () => {
    const email = renderNotificationEmail('team_matching', { status: 'accepted' }, origin);
    expect(email?.html).toContain('src="https://semochall.example/assets/SEMO.png"');
  });

  it('includes the leader-attached chat link in the accepted team notification', () => {
    const email = renderNotificationEmail(
      'team_matching',
      { teamId: 't', status: 'accepted', chatLink: 'https://open.kakao.com/o/abc' },
      origin,
    );
    expect(email?.subject).toContain('수락되었습니다');
    expect(email?.text).toContain('채팅방 링크: https://open.kakao.com/o/abc');
    expect(email?.html).toContain('채팅방 링크: https://open.kakao.com/o/abc');
  });

  it('keeps the accepted team notification body unchanged without a chat link', () => {
    const email = renderNotificationEmail(
      'team_matching',
      { teamId: 't', status: 'accepted' },
      origin,
    );
    expect(email?.text).toContain('신청하신 팀 참여가 수락되었습니다.');
    expect(email?.text).not.toContain('채팅방 링크');
  });

  it.each([
    ['빈 문자열', { teamId: 't', status: 'accepted', chatLink: '' }],
    ['공백만 있는 문자열', { teamId: 't', status: 'accepted', chatLink: '   ' }],
    ['문자열이 아닌 값', { teamId: 't', status: 'accepted', chatLink: 123 }],
  ])('omits the chat link line for %s', (_label, payload) => {
    const email = renderNotificationEmail('team_matching', payload, origin);
    expect(email?.text).not.toContain('채팅방 링크');
  });

  it('escapes HTML characters in the chat link', () => {
    const email = renderNotificationEmail(
      'team_matching',
      { teamId: 't', status: 'accepted', chatLink: 'https://x.example/?q=<b>&r=1' },
      origin,
    );
    expect(email?.text).toContain('https://x.example/?q=<b>&r=1');
    expect(email?.html).not.toContain('<b>');
    expect(email?.html).toContain('https://x.example/?q=&lt;b&gt;&amp;r=1');
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

  it('renders content.rejected with the title and admin reason, escaped', () => {
    const team = renderNotificationEmail(
      'content.rejected',
      { targetType: 'team', title: '팀 A', reason: '<b>부적절</b>' },
      origin,
    );
    expect(team?.subject).toContain('팀 모집글이 반려');
    expect(team?.text).toContain('반려 사유: <b>부적절</b>');
    expect(team?.html).toContain('&lt;b&gt;부적절&lt;/b&gt;');
    expect(team?.html).toContain('assets/SEMO.png');
    const challenge = renderNotificationEmail(
      'content.rejected',
      { targetType: 'challenge', title: '공고', reason: '사유' },
      origin,
    );
    expect(challenge?.subject).toContain('챌린지 공고가 반려');
    expect(challenge?.html).toContain('assets/SEMOBIZ.png');
  });

  it('escapes the link in HTML', () => {
    const email = renderNotificationEmail('team_matching', { status: 'accepted' }, 'https://x/"a');
    expect(email?.html).toContain('https://x/&quot;a/notifications');
  });
});
