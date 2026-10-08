import { describe, expect, it } from 'vitest';
import type { Database } from '../../db/drizzle.provider.js';
import type { OutboxService } from '../../outbox/outbox.service.js';
import { EmailService } from './email.service.js';

// select().from().innerJoin()/leftJoin().where().orderBy().limit() 체인을 호출 순서대로 결과를 돌려주는 목으로 대체한다.
function chain(result: unknown) {
  const node: Record<string, unknown> = {};
  for (const key of ['from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'limit']) {
    node[key] = () => node;
  }
  node.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return node;
}

function serviceWith(...results: unknown[]) {
  const queue = [...results];
  const db = { select: () => chain(queue.shift()) } as unknown as Database;
  return new EmailService(db, {} as OutboxService);
}

describe('EmailService.listAutomated', () => {
  const sent = [
    { id: 's1', sentAt: new Date('2026-10-02T00:00:00Z'), payload: { notificationId: 'n1' } },
  ];
  const notification = [
    {
      id: 'n1',
      type: 'team_matching',
      payload: { teamName: '세모' },
      email: 'kim.dev@gmail.com',
    },
  ];

  it('수신자 주소를 마스킹해서 돌려준다', async () => {
    const rows = await serviceWith(sent, notification).listAutomated();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.recipient).toBe('k***@gmail.com');
    expect(rows[0]?.status).toBe('sent');
    expect(JSON.stringify(rows)).not.toContain('kim.dev');
  });

  it('검색어로 수신자/제목을 거른다', async () => {
    const rows = await serviceWith(sent, notification).listAutomated({ q: 'zzz-no-match' });
    expect(rows).toHaveLength(0);
  });

  it('발송 내역이 없으면 알림 조회 없이 빈 배열을 돌려준다', async () => {
    expect(await serviceWith([]).listAutomated()).toEqual([]);
  });
});
