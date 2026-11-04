import { ThemeProvider } from '@emotion/react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/styles/theme';
import { BizPostingFormPage, normalizeFontTags } from '../components/BizPostingFormPage';

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
  recommendPosterCrop: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, back: vi.fn() }),
  useParams: () => ({}),
}));
vi.mock('@/apps/biz/components/BizShell', () => ({
  BizContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useBizHref: () => (path: string) => path,
}));
vi.mock('@/apps/user/components/common/Toast', () => ({
  useToast: () => ({ success: mocks.toastSuccess, error: mocks.toastError }),
}));
vi.mock('@/api/ad-api', () => ({
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
// 실제 OCR 엔진(tesseract.js)이 테스트에서 돌지 않게 막고, 반환값으로 자동 추천 흐름을 제어한다.
vi.mock('@/lib/poster-ocr', () => ({
  recommendPosterCropPosition: mocks.recommendPosterCrop,
}));

// 달력 팝오버를 열어 현재 보이는 달의 day일을 고른다.
function pickDay(label: string, day: number) {
  fireEvent.click(screen.getByLabelText(label));
  const dialog = screen.getByRole('dialog', { name: `${label} 달력` });
  fireEvent.click(
    within(dialog)
      .getAllByRole('button')
      .find((button) => button.textContent === String(day))!,
  );
}
const monthKey = (day: number, time = '') => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(day)}${time}`;
};

async function fillRequired() {
  fireEvent.change(screen.getByLabelText('공고 제목'), { target: { value: '해커톤' } });
  pickDay('접수 시작 일시', 1);
  fireEvent.click(screen.getByLabelText('접수 시작 일시 시'));
  fireEvent.click(screen.getByRole('option', { name: '09시' }));
  pickDay('접수 종료 일시', 20);
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
      set(value) {
        this.textContent = value;
      },
    });
    // jsdom에는 scrollIntoView가 없어 검증 실패 스크롤 이동이 동작하도록 stub한다.
    Element.prototype.scrollIntoView = vi.fn();
    mocks.create.mockResolvedValue({ data: { id: 'ch-1' } });
    vi.stubGlobal('fetch', mocks.fetchMock);
    mocks.fetchMock.mockResolvedValue({ ok: true });
    mocks.requestUpload.mockImplementation((args: { purpose?: string }) =>
      Promise.resolve({
        uploadUrl: 'https://upload.example',
        fileId: args?.purpose === 'poster' ? 'poster-1' : 'thumb-1',
      }),
    );
    mocks.finalizeUpload.mockResolvedValue({});
    // 기본은 추천 없음 — 모달이 중앙에서 시작하는 기존 동작이 유지된다.
    mocks.recommendPosterCrop.mockResolvedValue(null);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('인원 제한 입력이 없고, 접수 기간은 시각까지·행사 기간은 따로 입력한다', async () => {
    const { container } = renderForm();
    expect(screen.queryByLabelText('모집 인원')).toBeNull();
    expect(screen.getByLabelText('접수 시작 일시').textContent).toBe('날짜 선택');
    expect(screen.getByText('접수 기간')).toBeTruthy();
    expect(screen.getByText('행사 기간')).toBeTruthy();
    expect(container.querySelector('img[src*="role-calendar"]')).toBeNull();
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
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('주최')),
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('검증 실패 시 하단 텍스트 대신 토스트로 안내하고 첫 미작성 필드로 화면을 옮긴다', async () => {
    renderForm();
    await waitFor(() => expect(screen.getByText('게시하기')).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByText('게시하기'));
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith('제목, 상세정보, 접수 기간을 입력해 주세요.'),
    );
    expect(screen.queryByRole('alert')).toBeNull();
    // DOM 순서 기준 첫 미작성 필드(제목)로 스크롤 이동하고 포커스를 준다.
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    expect(document.activeElement).toBe(screen.getByLabelText('공고 제목'));
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('검증 실패 후 필드를 고치기 시작하면 남은 필드로 화면·포커스가 다시 이동하지 않는다', async () => {
    renderForm();
    await waitFor(() => expect(screen.getByText('게시하기')).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByText('게시하기'));
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1));
    const title = screen.getByLabelText('공고 제목');
    expect(document.activeElement).toBe(title);

    // invalid가 남아 있어도 제출 실패가 아니면(수정 시작) 스크롤·포커스 이동이 일어나지 않는다.
    fireEvent.change(title, { target: { value: '해' } });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(title);
  });

  it('상세정보가 첫 미작성 필드면 포커스 불가능한 래퍼 대신 본문 에디터로 포커스한다', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('공고 제목'), { target: { value: '해커톤' } });
    pickDay('접수 시작 일시', 1);
    pickDay('접수 종료 일시', 20);
    await waitFor(() => expect(screen.getByText('게시하기')).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByText('게시하기'));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    // aria-invalid는 EditorBox 래퍼에 붙지만, 포커스는 그 안의 contentEditable 본문으로 간다.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText('상세정보 본문')),
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('주최·주관·행사 기간·대상 기타를 함께 전송한다', async () => {
    renderForm();
    await fillRequired();
    fireEvent.change(screen.getByLabelText('주최'), { target: { value: '세모챌' } });
    fireEvent.change(screen.getByLabelText('주관'), { target: { value: '주관사' } });
    pickDay('행사 시작일', 10);
    pickDay('행사 종료일', 11);
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
    expect(data.startDate).toBe(new Date(monthKey(1, 'T09:00')).toISOString());
    expect(data.endDate).toBe(new Date(monthKey(20, 'T23:59')).toISOString());
    expect(new Date(data.eventStartDate).getDate()).toBe(10);
    expect(new Date(data.eventEndDate).getDate()).toBe(11);
  });

  it('추가된 카테고리와 주제를 선택해 공고 생성 payload에 전송한다', async () => {
    renderForm();
    await fillRequired();
    fireEvent.change(screen.getByLabelText('주최'), { target: { value: '세모챌' } });

    fireEvent.click(screen.getByLabelText('카테고리'));
    const categoryList = screen.getByRole('listbox', { name: '카테고리' });
    for (const category of ['대외활동', '홍보', '강연/강의'])
      expect(within(categoryList).getByRole('option', { name: category })).toBeTruthy();
    fireEvent.click(within(categoryList).getByRole('option', { name: '대외활동' }));

    const topics = screen.getByRole('group', { name: '주제' });
    const addedTopics = [
      '서포터즈/대회활동',
      '공모전 아이디어',
      '행사/전시/이벤트',
      '해외/국제',
      '강연/강의',
    ];
    for (const topic of addedTopics) {
      const chip = within(topics).getByRole('button', { name: topic });
      fireEvent.click(chip);
      expect(chip.getAttribute('aria-pressed')).toBe('true');
    }

    await waitFor(() => expect(screen.getByText('게시하기')).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByText('게시하기'));

    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ category: '대외활동', topics: addedTopics }),
      }),
    );
  });

  it('주제 칩을 중첩된 고정 행 없이 하나의 wrapping 컨테이너에 배치한다', () => {
    renderForm();

    const topics = screen.getByRole('group', { name: '주제' });
    const chips = within(topics).getAllByRole('button');
    expect(chips).toHaveLength(27);
    expect([...topics.children]).toEqual(chips);
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
    const size = screen.getByLabelText('글자 크기');
    expect(size.closest('[data-tip]')?.getAttribute('data-tip')).toBe('글자 크기');
    fireEvent.click(size);
    expect(screen.getByRole('option', { name: '24px' })).toBeTruthy();
    for (const label of ['글꼴', '글자 색', '가운데 정렬', '위 첨자'])
      expect(screen.getByLabelText(label).closest('[data-tip]')).toBeTruthy();
  });

  it('글자색·배경색은 팔레트에서 골라 에디터에 적용한다', () => {
    const exec = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: exec });
    renderForm();
    fireEvent.click(screen.getByLabelText('글자 색'));
    fireEvent.click(screen.getByRole('option', { name: '글자 색 #ef4444' }));
    expect(exec).toHaveBeenCalledWith('styleWithCSS', false, 'true');
    expect(exec).toHaveBeenCalledWith('foreColor', false, '#ef4444');
    expect(screen.queryByRole('listbox', { name: '글자 색 선택' })).toBeNull();

    fireEvent.click(screen.getByLabelText('배경(형광펜) 색'));
    fireEvent.click(screen.getByRole('option', { name: '배경(형광펜) 색 없음' }));
    expect(exec).toHaveBeenCalledWith('hiliteColor', false, 'transparent');
  });

  describe('링크', () => {
    const exec = vi.fn(() => true);
    beforeEach(() => {
      exec.mockClear();
      Object.defineProperty(document, 'execCommand', { configurable: true, value: exec });
    });

    it('prompt 대신 팝오버로 주소를 받고, 선택 글자가 없으면 표시 글자와 함께 삽입한다', () => {
      const prompt = vi.spyOn(window, 'prompt');
      renderForm();
      fireEvent.click(screen.getByLabelText('링크'));
      const dialog = screen.getByRole('dialog', { name: '링크 편집' });
      fireEvent.change(within(dialog).getByLabelText('링크 주소'), {
        target: { value: 'example.com/a' },
      });
      fireEvent.change(within(dialog).getByLabelText('표시할 글자 (선택)'), {
        target: { value: '신청 페이지' },
      });
      fireEvent.click(within(dialog).getByText('적용'));
      expect(prompt).not.toHaveBeenCalled();
      expect(exec).toHaveBeenCalledWith(
        'insertHTML',
        false,
        '<a href="https://example.com/a">신청 페이지</a>',
      );
      expect(screen.queryByRole('dialog', { name: '링크 편집' })).toBeNull();
    });

    it('올바르지 않은 주소는 팝오버 안에서 오류를 보여주고 닫지 않는다', () => {
      renderForm();
      fireEvent.click(screen.getByLabelText('링크'));
      const dialog = screen.getByRole('dialog', { name: '링크 편집' });
      fireEvent.change(within(dialog).getByLabelText('링크 주소'), {
        target: { value: 'javascript:alert(1)' },
      });
      fireEvent.click(within(dialog).getByText('적용'));
      expect(within(dialog).getByRole('alert').textContent).toContain('http(s)://');
      expect(exec).not.toHaveBeenCalledWith('insertHTML', false, expect.anything());
    });

    it('IME 조합 중 Enter는 적용하지 않고, 조합이 끝난 Enter만 적용한다', () => {
      renderForm();
      fireEvent.click(screen.getByLabelText('링크'));
      const dialog = screen.getByRole('dialog', { name: '링크 편집' });
      fireEvent.change(within(dialog).getByLabelText('링크 주소'), {
        target: { value: 'https://example.com' },
      });
      const text = within(dialog).getByLabelText('표시할 글자 (선택)');
      fireEvent.change(text, { target: { value: '신청' } });

      fireEvent.keyDown(text, { key: 'Enter', isComposing: true });
      expect(exec).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: '링크 편집' })).toBeTruthy();

      fireEvent.keyDown(text, { key: 'Enter' });
      expect(exec).toHaveBeenCalledWith(
        'insertHTML',
        false,
        '<a href="https://example.com">신청</a>',
      );
    });

    it('Esc로 닫는다', () => {
      renderForm();
      fireEvent.click(screen.getByLabelText('링크'));
      fireEvent.keyDown(screen.getByLabelText('링크 주소'), { key: 'Escape' });
      expect(screen.queryByRole('dialog', { name: '링크 편집' })).toBeNull();
    });
  });

  it('미리보기 버튼은 저장 없이 입력한 내용을 상세 화면 형태로 보여준다', async () => {
    renderForm();
    await fillRequired();
    fireEvent.change(screen.getByLabelText('주최'), { target: { value: '세모챌' } });
    fireEvent.change(screen.getByLabelText('설명문구'), { target: { value: '한 줄 소개' } });
    fireEvent.click(within(screen.getByRole('group', { name: '대상' })).getByText('기타'));
    fireEvent.change(screen.getByLabelText('대상 기타 내용'), { target: { value: '서울 거주' } });

    fireEvent.click(screen.getByText('미리보기'));

    const dialog = screen.getByRole('dialog', { name: '공고 미리보기' });
    expect(within(dialog).getByText('해커톤')).toBeTruthy();
    expect(within(dialog).getByText(/주최 세모챌/)).toBeTruthy();
    expect(within(dialog).getByText('서울 거주')).toBeTruthy();
    expect(within(dialog).getByText('한 줄 소개')).toBeTruthy();
    expect(within(dialog).getByText(/\.01 09:00 ~ .*\.20 23:59/)).toBeTruthy();
    expect(mocks.create).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '공고 미리보기' })).toBeNull();
  });

  it('해시태그·기타 입력란에는 예시 문구가 없다', () => {
    renderForm();
    expect(screen.getByLabelText('해시태그').getAttribute('placeholder')).toBeNull();
    fireEvent.click(within(screen.getByRole('group', { name: '대상' })).getByText('기타'));
    expect(screen.getByLabelText('대상 기타 내용').getAttribute('placeholder')).toBeNull();
  });

  // 크롭 모달(readImage/makeCroppedFile)이 쓰는 브라우저 API를 흉내 낸다.
  const stubCropApis = () => {
    URL.createObjectURL = vi.fn(() => 'blob:poster');
    URL.revokeObjectURL = vi.fn();
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 1200;
        naturalHeight = 900;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
        onload?: () => void;
        onerror?: () => void;
      },
    );
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never;
    HTMLCanvasElement.prototype.toBlob = vi.fn((callback) =>
      callback(new Blob(['webp'], { type: 'image/webp' })),
    ) as never;
  };
  const selectPoster = (container: HTMLElement, name = 'p.png') => {
    const input = container.querySelector('input[accept="image/*"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], name, { type: 'image/png' })] } });
  };
  const confirmCrop = async () => {
    fireEvent.click(await screen.findByRole('button', { name: '확인' }));
  };

  it('썸네일 크롭 모달을 취소하면 업로드 없이 닫힌다', async () => {
    stubCropApis();
    const { container } = renderForm();
    selectPoster(container);
    expect(await screen.findByRole('dialog')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocks.requestUpload).not.toHaveBeenCalled();
    expect(screen.queryByAltText('포스터 미리보기')).toBeNull();
  });

  it('포스터 업로드가 실패하면 이전 상태를 유지하고 오류를 보여준다', async () => {
    stubCropApis();
    mocks.requestUpload.mockRejectedValue(new Error('boom'));
    const { container } = renderForm();
    selectPoster(container);
    await confirmCrop();

    expect((await screen.findByRole('alert')).textContent).toContain('포스터 업로드에 실패');
    expect(screen.queryByAltText('포스터 미리보기')).toBeNull();
  });

  it('확인 시 원본 포스터와 썸네일을 함께 올리고 저장 payload에 둘 다 담는다', async () => {
    stubCropApis();
    (URL.createObjectURL as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce('blob:source')
      .mockReturnValueOnce('blob:cropped');
    const { container } = renderForm();
    const file = new File(['png-bytes'], 'poster.png', { type: 'image/png' });
    const input = container.querySelector('input[accept="image/*"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await confirmCrop();

    // 원본은 purpose=poster 그대로, 썸네일은 크롭된 WebP로 각각 업로드된다.
    await waitFor(() =>
      expect(mocks.requestUpload).toHaveBeenCalledWith({
        bucket: 'public',
        purpose: 'poster',
        contentType: 'image/png',
        fileName: 'poster.png',
        sizeBytes: file.size,
      }),
    );
    await waitFor(() =>
      expect(mocks.requestUpload).toHaveBeenCalledWith(
        expect.objectContaining({ bucket: 'public', contentType: 'image/webp' }),
      ),
    );
    expect(mocks.fetchMock).toHaveBeenCalledWith(
      'https://upload.example',
      expect.objectContaining({ body: file }),
    );
    await waitFor(() =>
      expect(screen.getByAltText('포스터 미리보기').getAttribute('src')).toBe('blob:cropped'),
    );

    await fillRequired();
    fireEvent.change(screen.getByLabelText('주최'), { target: { value: '세모챌' } });
    await waitFor(() => expect(screen.getByText('게시하기')).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByText('게시하기'));
    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0]![0].data).toMatchObject({
      posterFileId: 'poster-1',
      thumbnailFileId: 'thumb-1',
    });
  });

  it('새 포스터로 다시 업로드하면 이전 크롭 미리보기 URL을 해제한다', async () => {
    stubCropApis();
    (URL.createObjectURL as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce('blob:source-1')
      .mockReturnValueOnce('blob:cropped-1')
      .mockReturnValueOnce('blob:source-2')
      .mockReturnValueOnce('blob:cropped-2');
    const { container } = renderForm();

    selectPoster(container, 'first.png');
    await confirmCrop();
    await waitFor(() =>
      expect(screen.getByAltText('포스터 미리보기').getAttribute('src')).toBe('blob:cropped-1'),
    );

    selectPoster(container, 'second.png');
    await confirmCrop();
    await waitFor(() =>
      expect(screen.getByAltText('포스터 미리보기').getAttribute('src')).toBe('blob:cropped-2'),
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:cropped-1');
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

  // 크롭 모달 프리뷰의 좌측 오프셋(%). 원본 1200x900(비율 4/3)에 416:415 프레임이라
  // left = -position.x * (4/3 ÷ 416/415 - 1) * 100% = -position.x * 33.01% 꼴이다.
  const LEFT_FACTOR = (1200 / 900 / (416 / 415) - 1) * 100;
  const modalPreviewLeft = () =>
    parseFloat(screen.getByAltText('포스터 썸네일 자르기 미리보기').style.left);
  const CENTER_LEFT = -0.5 * LEFT_FACTOR;

  it('OCR 추천이 오면 사용자가 건드리기 전의 크롭 위치를 자동으로 잡는다', async () => {
    stubCropApis();
    mocks.recommendPosterCrop.mockResolvedValue({ x: 0.2, y: 0.5 });
    const { container } = renderForm();
    fireEvent.change(screen.getByLabelText('공고 제목'), { target: { value: '해커톤' } });
    selectPoster(container);
    expect(await screen.findByRole('dialog')).not.toBeNull();

    // 제목을 첫 대상으로 OCR이 호출되고, 결과 위치가 모달 프리뷰에 반영된다.
    await waitFor(() => expect(mocks.recommendPosterCrop).toHaveBeenCalled());
    expect(mocks.recommendPosterCrop.mock.calls[0]![1]).toEqual(['해커톤']);
    expect(mocks.recommendPosterCrop.mock.calls[0]![2]).toBeCloseTo(416 / 415, 6);
    await waitFor(() => expect(modalPreviewLeft()).toBeCloseTo(-0.2 * LEFT_FACTOR, 3));
  });

  it('이전 포스터의 늦은 OCR 결과는 취소 후 다시 고른 현재 모달에 적용되지 않는다', async () => {
    stubCropApis();
    const resolvers: Array<(value: { x: number; y: number }) => void> = [];
    mocks.recommendPosterCrop.mockImplementation(
      () => new Promise((resolve) => resolvers.push(resolve)),
    );
    const { container } = renderForm();
    fireEvent.change(screen.getByLabelText('공고 제목'), { target: { value: '해커톤' } });

    selectPoster(container, 'a.png');
    expect(await screen.findByRole('dialog')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    selectPoster(container, 'b.png');
    expect(await screen.findByRole('dialog')).not.toBeNull();
    expect(modalPreviewLeft()).toBeCloseTo(CENTER_LEFT, 3);

    // 취소했던 a.png의 OCR이 늦게 끝나도 b.png의 모달은 그대로 중앙에 둔다.
    await act(async () => {
      resolvers[0]!({ x: 0.8, y: 0.5 });
      await Promise.resolve();
    });
    expect(modalPreviewLeft()).toBeCloseTo(CENTER_LEFT, 3);

    // b.png의 OCR이 끝나면 그 위치를 적용한다.
    await act(async () => {
      resolvers[1]!({ x: 0.2, y: 0.5 });
      await Promise.resolve();
    });
    expect(modalPreviewLeft()).toBeCloseTo(-0.2 * LEFT_FACTOR, 3);
  });

  it('캐럿 상태에서 적용한 글자 크기도 제출 시 span으로 바꿔 서버에 별다른 손실 없이 보낸다', async () => {
    // jsdom에는 execCommand가 없어 스텁한다 — 크기 선택의 핵심은 마지막 크기 추적이다.
    Object.defineProperty(document, 'execCommand', { value: vi.fn(), configurable: true });
    renderForm();
    await fillRequired();
    fireEvent.change(screen.getByLabelText('주최'), { target: { value: '세모챌' } });
    // 캐럿 상태에서 글자 크기 18px 적용.
    fireEvent.click(screen.getByRole('combobox', { name: '글자 크기' }));
    fireEvent.click(screen.getByRole('option', { name: '18px' }));
    // Chrome은 이어지는 입력을 <font size="7">으로 물질화한다 — 같은 HTML을 심어 제출 경로를 검증한다.
    const editor = screen.getByLabelText('상세정보 본문');
    editor.innerHTML = '<div>AAA <font size="7">BBB</font></div>';
    await waitFor(() => expect(screen.getByText('게시하기')).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByText('게시하기'));

    await waitFor(() => expect(mocks.create).toHaveBeenCalled());
    const { data } = mocks.create.mock.calls[0]![0];
    expect(data.description).toContain('font-size: 18px');
    expect(data.description).not.toContain('<font');
  });

  it('에디터 캐럿 위치의 굵게 서식을 툴 버튼 눌림 상태로 표시한다', async () => {
    const queryCommandState = vi.fn().mockImplementation((command: string) => command === 'bold');
    Object.defineProperty(document, 'queryCommandState', {
      value: queryCommandState,
      configurable: true,
    });
    renderForm();
    const editor = screen.getByLabelText('상세정보 본문');
    editor.innerHTML = '<div>hello</div>';
    const range = document.createRange();
    range.setStart(editor.firstChild!.firstChild!, 1);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    await act(async () => {
      document.dispatchEvent(new Event('selectionchange'));
    });
    expect(screen.getByRole('button', { name: '굵게' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '기울임' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });
});

describe('normalizeFontTags', () => {
  const build = (html: string) => {
    const root = document.createElement('div');
    root.innerHTML = html;
    return root;
  };

  it('font[size=7]를 지정한 px의 span으로 바꾼다', () => {
    const root = build('<div>AAA <font size="7">BBB</font></div>');
    normalizeFontTags(root, 18);
    expect(root.innerHTML).toBe('<div>AAA <span style="font-size: 18px;">BBB</span></div>');
  });

  it('px 정보가 없으면 font-size 없이 span으로만 바꾼다', () => {
    const root = build('<font size="7">x</font>');
    normalizeFontTags(root, null);
    expect(root.innerHTML).toBe('<span>x</span>');
  });

  it('color·face 속성을 span style로 옮긴다', () => {
    const root = build('<font color="#ef4444" face="Nanum Myeongjo, serif">x</font>');
    normalizeFontTags(root, null);
    const style = root.querySelector('span')!.getAttribute('style')!;
    expect(style).toContain('color:');
    expect(style).toContain('font-family:');
  });

  it('color·face·size를 한 span에 모두 옮긴다', () => {
    const root = build('<font size="7" color="#ef4444" face="Nanum Myeongjo, serif">x</font>');
    normalizeFontTags(root, 24);
    const style = root.querySelector('span')!.getAttribute('style')!;
    expect(style).toContain('font-size: 24px');
    expect(style).toContain('color:');
    expect(style).toContain('font-family:');
  });

  it('font 안의 캐럿을 변환 뒤 같은 텍스트 오프셋에 되살린다', () => {
    const root = build('<div>a<font size="7">bcde</font>f</div>');
    // jsdom은 document 안의 트리에서만 selection을 유지하므로 붙여서 검증한다.
    document.body.appendChild(root);
    try {
      const fontText = root.querySelector('font')!.firstChild!;
      const range = document.createRange();
      range.setStart(fontText, 2);
      range.collapse(true);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      normalizeFontTags(root, 18);
      expect(root.querySelector('font')).toBeNull();
      const spanText = root.querySelector('span')!.firstChild!;
      expect(selection.anchorNode).toBe(spanText);
      expect(selection.anchorOffset).toBe(2);
    } finally {
      root.remove();
    }
  });

  it('빈 style 속성을 정리한다', () => {
    const root = build('<b style="">x</b><font size="7">y</font>');
    normalizeFontTags(root, 18);
    expect(root.innerHTML).toBe('<b>x</b><span style="font-size: 18px;">y</span>');
  });

  it('font 태그가 없으면 본문을 그대로 둔다', () => {
    const root = build('<p>hello</p>');
    normalizeFontTags(root, 18);
    expect(root.innerHTML).toBe('<p>hello</p>');
  });
});
