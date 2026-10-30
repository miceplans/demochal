import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { SaveInterestsDto } from './save-interests.dto.js';

const errorsFor = (body: Record<string, unknown>) =>
  validateSync(plainToInstance(SaveInterestsDto, body));

describe('SaveInterestsDto', () => {
  it('accepts a non-empty string category list', () => {
    expect(errorsFor({ categories: ['IT/SW'] })).toHaveLength(0);
  });

  // 빈 배열이 저장되면 users.interests가 []가 되어 GET /interests의 온볼딩 설문
  // 평백이 다시 발동하므로, 빈 관심분야는 저장할 수 없게 막는다.
  it('rejects an empty category list', () => {
    expect(errorsFor({ categories: [] })).not.toHaveLength(0);
  });

  it.each([['IT/SW', 123], 'not-an-array', null])('rejects a non-string-list: %s', (categories) => {
    expect(errorsFor({ categories })).not.toHaveLength(0);
  });
});
