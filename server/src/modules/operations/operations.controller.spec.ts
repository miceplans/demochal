import { describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { OperationsController } from './operations.controller.js';
import type { OperationsService } from './operations.service.js';

describe('OperationsController', () => {
  it('submits the inquiry through the service without requiring a logged-in user', async () => {
    const operationsService = {
      createInquiry: vi.fn().mockResolvedValue({ id: 'inq-1', received: true }),
    };
    const controller = new OperationsController(operationsService as unknown as OperationsService);
    const dto = { name: '홍길동', contact: '010-1234-5678', content: '행사 운영대행 견적 문의' };

    await expect(controller.createInquiry(dto)).resolves.toEqual({ id: 'inq-1', received: true });
    expect(operationsService.createInquiry).toHaveBeenCalledWith(dto);
  });

  it('is decorated as @Public so logged-out visitors can submit (공개 문의 정책)', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, OperationsController.prototype.createInquiry)).toBe(
      true,
    );
  });
});
