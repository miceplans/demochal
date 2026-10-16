import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, generated } from '@semochal/api-client';
import { ChallengeSearch } from './ChallengeSearch';

vi.mock('@semochal/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@semochal/api-client')>();
  return {
    ...actual,
    generated: {
      useListChallenges: vi.fn(),
      useGetChallenge: vi.fn(),
    },
  };
});

function mockChallenges(items: unknown[] = []) {
  vi.mocked(generated.useListChallenges).mockReturnValue({
    isLoading: false,
    data: { data: { items } },
  } as never);
}

function mockPreset(result: { status: number; data: unknown }) {
  vi.mocked(generated.useGetChallenge).mockReturnValue({
    isPending: false,
    data: result,
  } as never);
}

describe('ChallengeSearch', () => {
  beforeEach(() => {
    mockChallenges();
    vi.mocked(generated.useGetChallenge).mockReturnValue({
      isPending: false,
      data: undefined,
    } as never);
  });

  afterEach(cleanup);

  it('includeClosed를 지정하지 않으면 기본적으로 종료 챌린지를 포함해 검색한다', () => {
    render(<ChallengeSearch value="" onChange={vi.fn()} />);
    expect(generated.useListChallenges).toHaveBeenCalledWith(
      expect.objectContaining({ includeClosed: true }),
      expect.anything(),
    );
  });

  it('검색어를 입력하면 디바운스 뒤 q와 includeClosed로 목록을 조회한다', async () => {
    render(<ChallengeSearch value="" onChange={vi.fn()} includeClosed={false} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '해커톤' } });
    await waitFor(() =>
      expect(generated.useListChallenges).toHaveBeenCalledWith(
        expect.objectContaining({ q: '해커톤', includeClosed: false }),
        expect.anything(),
      ),
    );
  });

  it('검색 결과를 고륾으면 onChange로 id를 알리고 선택 이름을 고정해 보여준다', () => {
    mockChallenges([{ id: 'c1', title: 'AI 해커톤' }]);
    const onChange = vi.fn();
    const { rerender } = render(<ChallengeSearch value="" onChange={onChange} />);
    fireEvent.focus(screen.getByRole('combobox'));
    fireEvent.mouseDown(screen.getByRole('option', { name: 'AI 해커톤' }));
    expect(onChange).toHaveBeenCalledWith('c1');
    // 부모가 value로 id를 돌려주면 검색 입력 대신 선택 항목을 보여준다.
    rerender(<ChallengeSearch value="c1" onChange={onChange} />);
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('AI 해커톤')).toBeTruthy();
  });

  it('선택 해제 버튼을 누륾면 빈 값으로 알린다', () => {
    mockPreset({ status: 200, data: { title: 'AI 해커톤' } });
    const onChange = vi.fn();
    render(<ChallengeSearch value="c1" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '챌린지 선택 해제' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('외부에서 id만 지정하면 상세 조회로 챌린지 이름을 표시한다', () => {
    mockPreset({ status: 200, data: { title: '빅데이터 공모전' } });
    render(<ChallengeSearch value="preset-1" onChange={vi.fn()} />);
    expect(generated.useGetChallenge).toHaveBeenCalledWith('preset-1', expect.anything());
    expect(screen.getByText('빅데이터 공모전')).toBeTruthy();
  });

  it('존재하지 않는 id면 알 수 없는 챌린지로 표시한다', () => {
    // HttpClient는 non-2xx를 ApiError로 던지므로 404는 error 상태로 들어온다.
    vi.mocked(generated.useGetChallenge).mockReturnValue({
      isPending: false,
      data: undefined,
      error: new ApiError(404, undefined),
    } as never);
    render(<ChallengeSearch value="gone" onChange={vi.fn()} />);
    expect(screen.getByText('알 수 없는 챌린지')).toBeTruthy();
  });
});
