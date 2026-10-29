import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Application } from '@semochal/api-client';
import { ApplicationResponsePanel } from './ApplicationResponsePanel';

vi.mock('@semochal/api-client', () => ({ generated: { getApplicationAttachment: vi.fn() } }));
vi.mock('@/components/common/Toast', () => ({ useToast: () => ({ error: vi.fn() }) }));
afterEach(cleanup);

const application: Application = {
  id: 'app-1',
  challengeId: 'c-1',
  userId: 'user-12345678',
  status: 'reviewing',
  createdAt: '2026-10-01T00:00:00Z',
  teammates: ['세모팀'],
  evaluation: 'undecided',
  formAnswers: [{ questionId: 'q1', title: '지원 동기', type: 'long', value: '열심히 하겠습니다' }],
};

describe('ApplicationResponsePanel', () => {
  it('shows the answers and toggles fullscreen', async () => {
    const user = userEvent.setup();
    render(<ApplicationResponsePanel application={application} onClose={() => {}} />);
    expect(screen.getByText('지원 동기')).toBeTruthy();
    expect(screen.getByText('열심히 하겠습니다')).toBeTruthy();
    const panel = screen.getByRole('complementary', { name: '신청서 응답' });
    expect(panel.getAttribute('data-fullscreen')).toBeNull();
    await user.click(screen.getByRole('button', { name: '전체화면' }));
    expect(panel.getAttribute('data-fullscreen')).toBe('true');
  });

  it('closes on the close button and Escape (fullscreen first)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ApplicationResponsePanel application={application} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '전체화면' }));
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: '신청서 응답 닫기' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
