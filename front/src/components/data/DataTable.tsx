'use client';

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import styled from '@emotion/styled';

interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  emptyMessage?: string;
}

const TableWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  border: 1px solid ${(p) => p.theme.colors.gray[200]};
  border-radius: 10px;
  background: ${(p) => p.theme.colors.background};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
`;

const Th = styled.th<{ sortable?: boolean }>`
  text-align: left;
  padding: 12px 14px;
  background: ${(p) => p.theme.colors.gray[100]};
  color: ${(p) => p.theme.colors.gray[700]};
  font-weight: 600;
  white-space: nowrap;
  cursor: ${(p) => (p.sortable ? 'pointer' : 'default')};
  border-bottom: 1px solid ${(p) => p.theme.colors.gray[200]};
`;

const Td = styled.td`
  padding: 12px 14px;
  border-bottom: 1px solid ${(p) => p.theme.colors.gray[100]};
  color: ${(p) => p.theme.colors.gray[900]};
  white-space: nowrap;
`;

const EmptyRow = styled.tr`
  td {
    text-align: center;
    padding: 40px 14px;
    color: ${(p) => p.theme.colors.gray[500]};
  }
`;

// Generic sortable data table for admin / business screens.
// Columns are declared per page via TanStack Table's ColumnDef.
export function DataTable<TData>({
  data,
  columns,
  emptyMessage = '데이터가 없습니다.',
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <TableWrapper>
      <Table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <Th
                  key={header.id}
                  sortable={header.column.getCanSort()}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted() as string] ?? ''}
                </Th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <EmptyRow>
              <td colSpan={columns.length}>{emptyMessage}</td>
            </EmptyRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <Td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </TableWrapper>
  );
}
