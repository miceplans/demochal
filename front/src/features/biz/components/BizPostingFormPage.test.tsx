import { ThemeProvider } from '@emotion/react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/styles/theme';
import { BizPostingFormPage } from './BizPostingFormPage';

const renderForm = () =>
  render(
    <ThemeProvider theme={theme}>
      <BizPostingFormPage />
    </ThemeProvider>,
  );

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  push: vi.fn(),
  requestUpload: vi.fn(),
  finalizeUpload: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, back: vi.fn() }),
  useParams: () => ({}),
}));
vi.mock('@/components/biz/BizShell', () => ({
  BizContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useBizHref: () => (path: string) => path,
}));
vi.mock('@/components/common/Toast', () => ({ useToast: () => ({ success: vi.fn() }) }));
vi.mock('@/lib/ad-api', () => ({
  adError: () => '오류',
  adApi: {
    businesses: { me: async () => ({ id: 'biz-1' }) },
    files: { requestUpload: mocks.requestUpload, finalizeUpload: mocks.finalizeUpload },
  },
}));
vi.mock('@semochal/api-client', () => ({
  generated: {
    useCreateChallenge: () => ({ mutateAsync: mocks.create }),
  },
}));

async function fillRequired() {
  fireEvent.change(screen.getByLabelText('공고 제목'), { target: { value: '해커톤' } });
  fireEvent.change(screen.getByLabelText('접수 시작 일시'), {
    target: { value: '2029-01-01T09:30' },
  });
  fireEvent.change(screen.getByLabelText('접수 종료 일시'), {
    target: { value: '2029-01-31T18:00' },
  });
  const editor = screen.getByLabelText('상세정보 본문');
  editor.innerHTML = '<p>내용</p>';
}

describe('BizPostingFormPage', () => {
  beforeEach(() => {
    // jsdom에는 innerText가 없어 에디터 본문 검사가 동작하도록 textContent로 대신한다.
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
      configurable: true,
      get() {
        return this.textContent;
      },
      set(value: string) {
        this.textContent = value;
      },
    });
    mocks.create.mockResolvedValue({ data: { id: 'ch-1' } });
    vi.stubGlobal('fetch', mocks.fetchMock);
    mocks.fetchMock.mockResolvedValue({ ok: true });
    mocks.requestUpload.mockResolvedValue({ uploadUrl: 'https://upload.example', fileId: 'f-1' });
    mocks.finalizeUpload.mockResolvedValue({});
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('인원 제한 입력이 없고, 접수 기간은 시각까지·행사 기간은 따로 입력한다', async () => {
    renderForm();
    expect(screen.queryByLabelText('모집 인원')).toBeNull();
    expect(screen.getByLabelText('접수 시작 일시')).toHaveProperty('type', 'datetime-local');
    expect(screen.getByLabelText('행사 시작일')).toHaveProperty('type', 'date');
  });

  it('대상 칩은 제한없음이 맨 앞이고, 기타를 고르면 직접 입력란이 열린다', () => {
    renderForm();
    const group = screen.getByRole('group', { name: '대상' });
    expect(within(group).getAllByRole('button')[0]?.textContent).toBe('제한없음');
    expect(within(group).queryByText('지역제한')).toBeNull();
    expect(screen.queryByLabelText('대상 기타 내용')).toBeNull();
    fireEvent.click(within(group).getByText('기타'));
    expect(screen.getByLabelText('대상 기타 내용')).toBeTruthy();
  });

  it('주최는 필수이고 비어 있으면 게시하지 않는다', async () => {
    renderForm();
    await fillRequired();
    await waitFor(() => expect(screen.getByText('게시하기')).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByText('게시하기'));
    expect((await screen.findByRole('alert')).textContent).toContain('주최');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('주최·주관·행사 기간·대상 기타를 함께 전송한다', async () => {
    renderForm();
    await fillRequired();
    fireEvent.change(screen.getByLabelText('주최'), { target: { value: '세모챌' } });
    fireEvent.change(screen.getByLabelText('주관'), { target: { value: '주관사' } });
    fireEvent.change(screen.getByLabelText('행사 시작일'), { target: { value: '2029-02-10' } });
    fireEvent.change(screen.getByLabelText('행사 종료일'), { target: { value: '2029-02-11' } });
    fireEvent.click(within(screen.getByRole('group', { name: '대상' })).getByText('기타'));
    fireEvent.change(screen.getByLabelText('대상 기타 내용'), { target: { value: '서울 거주' } });
    await waitFor(() => expect(screen.getByText('게시하기')).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByText('게시하기'));

    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    const { data } = mocks.create.mock.calls[0]![0];
    expect(data).toMatchObject({
      host: '세모챌',
      supervisor: '주관사',
      targetOther: '서울 거주',
      targets: ['기타'],
      attachments: [],
    });
    expect(data).not.toHaveProperty('capacity');
    expect(data.sponsor).toBeUndefined();
    expect(data.startDate).toBe(new Date('2029-01-01T09:30').toISOString());
    expect(new Date(data.eventStartDate).getDate()).toBe(10);
    expect(new Date(data.eventEndDate).getDate()).toBe(11);
  });

  it('첨부파일을 private 버킷으로 올리고 목록에서 제거할 수 있다', async () => {
    renderForm();
    const input = screen.getByLabelText('첨부파일 선택');
    const file = new File(['pdf'], '요강.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText(/요강\.pdf/)).toBeTruthy();
    expect(mocks.requestUpload).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'private', contentType: 'application/pdf' }),
    );
    fireEvent.click(screen.getByLabelText('요강.pdf 삭제'));
    expect(screen.queryByText(/요강\.pdf/)).toBeNull();
  });

  it('지원하지 않는 첨부 형식은 거절한다', async () => {
    renderForm();
    const file = new File(['x'], 'run.exe', { type: 'application/octet-stream' });
    fireEvent.change(screen.getByLabelText('첨부파일 선택'), { target: { files: [file] } });
    expect((await screen.findByRole('alert')).textContent).toContain('지원하지 않는');
    expect(mocks.requestUpload).not.toHaveBeenCalled();
  });

  it('텍스트 서식 도구는 호버 툴팁 이름과 글자 크기 드롭다운을 가진다', () => {
    renderForm();
    const bold = screen.getByLabelText('굵게');
    expect(bold.parentElement?.getAttribute('data-tip')).toBe('굵게');
    const size = screen.getByLabelText('글자 크기') as HTMLSelectElement;
    expect(size.parentElement?.getAttribute('data-tip')).toBe('글자 크기');
    expect(Array.from(size.options).map((o) => o.text)).toContain('24px');
    for (const label of ['글꼴', '글자 색', '가운데 정렬', '위 첨자'])
      expect(screen.getByLabelText(label).closest('[data-tip]')).toBeTruthy();
  });

  it('포스터는 변환 없이 원본 파일 그대로 올리고 그 파일로 미리보기를 만든다', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:poster');
    URL.revokeObjectURL = vi.fn();
    const { container } = renderForm();
    const file = new File(['png-bytes'], 'poster.png', { type: 'image/png' });
    const input = container.querySelector('input[accept="image/*"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect((await screen.findByAltText('포스터 미리보기')).getAttribute('src')).toBe('blob:poster');
    expect(mocks.requestUpload).toHaveBeenCalledWith({
      bucket: 'public',
      purpose: 'poster',
      contentType: 'image/png',
      fileName: 'poster.png',
      sizeBytes: file.size,
    });
    expect(mocks.fetchMock).toHaveBeenCalledWith(
      'https://upload.example',
      expect.objectContaining({ body: file }),
    );
  });

  it('JPG/PNG/WebP가 아닌 포스터는 거절한다', async () => {
    const { container } = renderForm();
    const input = container.querySelector('input[accept="image/*"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] },
    });
    expect((await screen.findByRole('alert')).textContent).toContain('JPG');
    expect(mocks.requestUpload).not.toHaveBeenCalled();
  });
});
