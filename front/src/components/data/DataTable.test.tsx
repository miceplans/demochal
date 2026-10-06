import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ColumnDef } from '@tanstack/react-table';
import { ThemeProvider } from '@emotion/react';
import { DataTable } from './DataTable';
import { theme } from '@/styles/theme';

type Row = { id: string; name: string };
const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: 'name', header: '이름' },
  { accessorKey: 'id', header: 'ID' },
];

describe('DataTable sort indicator', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders no sort mark initially and keeps a single rotating mark between asc and desc', () => {
    render(
      <ThemeProvider theme={theme}>
        <DataTable
          data={[
            { id: 'a', name: 'A' },
            { id: 'b', name: 'B' },
          ]}
          columns={columns}
        />
      </ThemeProvider>,
    );

    // 정렬 전에는 화살표가 없다.
    expect(screen.getByRole('columnheader', { name: '이름' }).textContent).toBe('이름');

    // 첫 클릭(asc): aria-hidden 화살표 마크가 정확히 하나 생긴다.
    fireEvent.click(screen.getByRole('columnheader', { name: '이름' }));
    const ascMarks = screen.getAllByText('▲');
    expect(ascMarks).toHaveLength(1);
    expect(ascMarks[0]!.getAttribute('aria-hidden')).toBe('true');

    // 다시 클릭(desc): 마크가 늘어나지 않고 회전으로만 방향을 바꾼다(예전 ▼ 텍스트 미사용).
    fireEvent.click(screen.getByRole('columnheader', { name: /이름/ }));
    expect(screen.getAllByText('▲')).toHaveLength(1);
    expect(screen.queryByText('▼')).toBeNull();
  });
});
