'use client';

import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { useToast } from '@/components/common/Toast';
import {
  AdminInlineNotice,
  AdminPageTitle,
  AdminTable,
  ApproveButton,
  RejectButton,
  type AdminColumn,
} from './parts';

type RequestRow = { id: string; userId: string; userName: string; label: string; url: string };

// 사용자가 신청한 포트폴리오 뱃지(신청 중)를 승인/거부한다. 승인돼야 다른 사용자에게 뱃지가 보인다.
export function AdminPortfolioBadgesScreen() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const listQuery = generated.useListAdminPortfolioBadgeRequests();
  const review = generated.useReviewAdminPortfolioBadge({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: generated.getListAdminPortfolioBadgeRequestsQueryKey(),
        });
      },
      onError: () => toast.error('처리에 실패했어요', '잠시 후 다시 시도해주세요'),
    },
  });

  const rows: RequestRow[] = (listQuery.data?.status === 200 ? listQuery.data.data : []).map(
    (item) => ({
      id: item.id ?? `${item.userId}:${item.url}`,
      userId: item.userId ?? '',
      userName: item.userName ?? '이름 없음',
      label: item.label ?? '',
      url: item.url ?? '',
    }),
  );

  const columns: AdminColumn<RequestRow>[] = [
    { key: 'userName', header: '사용자', width: 160 },
    { key: 'label', header: '링크 이름', width: 160 },
    { key: 'url', header: '링크 주소' },
    {
      key: 'actions',
      header: '처리',
      width: 200,
      render: (row) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <ApproveButton
            type="button"
            disabled={review.isPending}
            onClick={() =>
              review.mutate({ userId: row.userId, data: { url: row.url, action: 'approve' } })
            }
          >
            승인
          </ApproveButton>
          <RejectButton
            type="button"
            disabled={review.isPending}
            onClick={() =>
              review.mutate({ userId: row.userId, data: { url: row.url, action: 'reject' } })
            }
          >
            거부
          </RejectButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <AdminPageTitle>포트폴리오 뱃지</AdminPageTitle>
      {listQuery.isPending ? (
        <AdminInlineNotice>불러오는 중이에요.</AdminInlineNotice>
      ) : rows.length === 0 ? (
        <AdminInlineNotice>신청 중인 포트폴리오 뱃지가 없어요.</AdminInlineNotice>
      ) : (
        <AdminTable columns={columns} rows={rows} />
      )}
    </>
  );
}
