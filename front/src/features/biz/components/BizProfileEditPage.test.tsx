import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BizProfileEditPage } from './BizProfileEditPage';

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@semochal/api-client', () => ({
  generated: {
    useFindMyBusiness: () => ({
      data: {
        status: 200,
        data: {
          id: 'business-1',
          name: '세모챌',
          address: '서울특별시',
          phone: '02-0000-0000',
          email: 'biz@example.com',
        },
      },
      isError: false,
      isPending: false,
    }),
    useGetFile: () => ({ data: undefined }),
    useRequestPresignedUpload: () => ({ mutateAsync: vi.fn() }),
    useFinalizeUpload: () => ({ mutateAsync: vi.fn() }),
    useUpdateBusiness: () => ({ mutateAsync: vi.fn(), isPending: false }),
    getFindMyBusinessQueryKey: () => ['business'],
  },
}));
vi.mock('@/components/biz/BizShell', () => ({
  BizContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OutlineButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  PrimaryButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  useBizHref: () => (path: string) => path,
}));
vi.mock('@/components/biz/BizOrgProfile', () => ({
  BizOrgProfile: ({ name, address, phone, email }: Record<string, React.ReactNode>) => (
    <div>
      {name}
      {address}
      {phone}
      {email}
    </div>
  ),
}));
vi.mock('@/components/common/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

describe('BizProfileEditPage', () => {
  afterEach(cleanup);

  it('renders every profile field with a visible default border', () => {
    render(<BizProfileEditPage />);

    for (const label of ['기업명', '주소', '전화번호', '이메일']) {
      const field = screen.getByLabelText(label);
      expect(getComputedStyle(field).borderColor).not.toBe('transparent');
    }
  });
});
