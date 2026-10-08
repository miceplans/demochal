import { describe, expect, it } from 'vitest';
import { presentBizVerificationStatus } from './verification-status';

describe('presentBizVerificationStatus', () => {
  it.each([
    ['pending', { label: '미승인', tone: 'gray' }],
    ['verified', { label: '승인', tone: 'green' }],
    ['rejected', { label: '반려', tone: 'red' }],
  ])('presents %s as a distinct business status', (status, expected) => {
    expect(presentBizVerificationStatus(status)).toEqual(expected);
  });

  it('treats an unavailable status as pending instead of granting approval', () => {
    expect(presentBizVerificationStatus(undefined)).toEqual({ label: '미승인', tone: 'gray' });
  });
});
