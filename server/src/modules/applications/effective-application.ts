import { sql } from 'drizzle-orm';
import { applications, orders } from '../../db/schema.js';

/**
 * 실제 접수된 신청인지 판정하는 조건. 가격 정책이 바뀌어도 신청 당시의 결제 이력으로
 * 판단한다: 주문이 하나도 없는 신청(무료 접수)이거나, paid 주문이 있는 신청만 포함한다.
 * pending/canceled 주문만 있는 신청은 결제가 끝나지 않았으므로 제외한다.
 */
export const effectiveApplicationCondition = sql`(
  not exists (select 1 from ${orders} where ${orders.applicationId} = ${applications.id})
  or exists (select 1 from ${orders} where ${orders.applicationId} = ${applications.id} and ${orders.status} = 'paid')
)`;
