import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationAnswers } from './ApplicationAnswers';

const mocks = vi.hoisted(() => ({ getFile: vi.fn(), error: vi.fn() }));
vi.mock('@semochal/api-client', () => ({ generated: { getApplicationAttachment: mocks.getFile } }));
vi.mock('@/components/common/Toast', () => ({ useToast: () => ({ error: mocks.error }) }));
afterEach(cleanup);
describe('Biz application answers', () => {
  it('shows the submitted question snapshots and multi-select answers', async () => {
    render(
      <ApplicationAnswers
        applicationId="app-1"
        answers={[
          { questionId: 'q1', title: '제출 당시 질문', type: 'checkbox', value: ['A', 'B'] },
        ]}
      />,
    );
    await userEvent.setup().click(screen.getByText('신청서 응답 보기'));
    expect(screen.getByText('제출 당시 질문')).toBeTruthy();
    expect(screen.getByText('A, B')).toBeTruthy();
  });
  it('requests a file through the application-scoped endpoint and reports access failure', async () => {
    mocks.getFile.mockRejectedValueOnce(new Error('not allowed'));
    render(
      <ApplicationAnswers
        applicationId="app-1"
        answers={[{ questionId: 'q1', title: '자료', type: 'file', value: 'file-1' }]}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByText('신청서 응답 보기'));
    await user.click(screen.getByRole('button', { name: '첨부파일 열기' }));
    expect(mocks.getFile).toHaveBeenCalledWith('app-1', 'file-1');
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith('첨부파일을 열지 못했습니다. 다시 시도해 주세요.'),
    );
  });
});
