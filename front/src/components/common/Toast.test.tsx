import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './Toast';

function Trigger({ message, withAction }: { message: string; withAction?: boolean }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        withAction
          ? toast.info(message, undefined, {
              action: { label: '열기', onClick: () => {} },
            })
          : toast.error(message)
      }
    >
      트리거
    </button>
  );
}

function renderToast(message: string, withAction = false) {
  return render(
    <ToastProvider>
      <Trigger message={message} withAction={withAction} />
    </ToastProvider>,
  );
}

describe('Toast exit animation lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('keeps a dismissed toast in the DOM during the exit animation and removes it afterwards', () => {
    renderToast('저장 실패');
    fireEvent.click(screen.getByRole('button', { name: '트리거' }));
    expect(screen.getByText('저장 실패')).toBeTruthy();

    fireEvent.click(screen.getByText('저장 실패'));
    // 퇴장 애니메이션(200ms) 동안에는 여전히 DOM에 있다.
    expect(screen.getByText('저장 실패')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('저장 실패')).toBeNull();
  });

  it('removes an auto-dismissed toast after the visible duration plus the exit delay', () => {
    renderToast('자동 종료');
    fireEvent.click(screen.getByRole('button', { name: '트리거' }));

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // 3초 자동 dismiss 직후에는 퇴장 중이므로 아직 화면에 있다.
    expect(screen.getByText('자동 종료')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('자동 종료')).toBeNull();
  });

  it('tolerates repeated dismiss calls without breaking removal', () => {
    renderToast('중복 클릭');
    fireEvent.click(screen.getByRole('button', { name: '트리거' }));

    const toast = screen.getByText('중복 클릭');
    fireEvent.click(toast);
    fireEvent.click(toast);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('중복 클릭')).toBeNull();
    // 이미 제거된 뒤 도착하는 늦은(자동) dismiss 타임아웃도 오류 없이 무시된다.
    act(() => {
      vi.advanceTimersByTime(3200);
    });
    expect(screen.queryByText('중복 클릭')).toBeNull();
  });

  it('runs the action and dismisses through the same exit flow', () => {
    renderToast('액션 토스트', true);
    fireEvent.click(screen.getByRole('button', { name: '트리거' }));
    expect(screen.getByText('액션 토스트')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '열기' }));
    // 액션 실행 즉시 사라지지 않고 퇴장 애니메이션을 거친다.
    expect(screen.getByText('액션 토스트')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('액션 토스트')).toBeNull();
  });
});
