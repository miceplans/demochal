'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, generated } from '@semochal/api-client';
import { useToast } from '@/components/common/Toast';

type BookmarkSort = 'deadline' | 'latest' | 'popular';

export function isBookmarkableId(id: string | undefined): id is string {
  return (
    !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

export function useBookmarks(sort?: BookmarkSort) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const queryClient = useQueryClient();
  const auth = generated.useGetMyAuthInfo({ query: { retry: false } });
  const bookmarks = generated.useListMyBookmarks(sort ? { sort } : undefined, {
    query: { enabled: auth.data?.status === 200 },
  });
  const queryKey = generated.getListMyBookmarksQueryKey(sort ? { sort } : undefined);
  const toggle = generated.useToggleBookmark({
    mutation: {
      onMutate: async ({ id, data }) => {
        await queryClient.cancelQueries({ queryKey: ['/bookmarks'] });
        const previous = queryClient.getQueryData<typeof bookmarks.data>(queryKey);
        const current = previous?.data ?? [];
        const next = data.bookmarked
          ? [...current.filter((challenge) => challenge.id !== id), { id }]
          : current.filter((challenge) => challenge.id !== id);
        if (previous) queryClient.setQueryData(queryKey, { ...previous, data: next });
        return { previous };
      },
      onError: (error, _variables, context) => {
        if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
        if (error instanceof ApiError && error.status === 401) {
          router.push(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        toast.error('북마크를 저장하지 못했어요', '잠시 후 다시 시도해주세요');
      },
      onSuccess: (response) => {
        toast.success(response.data.bookmarked ? '북마크에 저장했어요' : '북마크를 해제했어요');
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: ['/bookmarks'] });
      },
    },
  });

  const toggleBookmark = (id: string | undefined) => {
    if (!isBookmarkableId(id) || auth.isPending) return;
    if (auth.data?.status !== 200) {
      // 401일 때만 비로그인으로 본다. 인증 조회 자체가 실패한 경우엔 로그인으로 보내지 않는다.
      if (auth.error instanceof ApiError && auth.error.status === 401) {
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
      } else {
        toast.error('로그인 상태를 확인하지 못했어요', '잠시 후 다시 시도해주세요');
      }
      return;
    }
    // 현재 저장 여부를 모르는 상태(목록 로딩/실패)에선 토글 방향을 잘못 보낼 수 있어 막는다.
    if (!bookmarks.isSuccess) return;
    toggle.mutate({
      id,
      data: { bookmarked: !(bookmarks.data?.data ?? []).some((item) => item.id === id) },
    });
  };

  return {
    bookmarks: bookmarks.data?.data ?? [],
    // 비로그인이면 목록 쿼리가 비활성(영원히 pending)이라 인증 확인 중일 때만 로딩으로 본다.
    isPending: auth.isPending || (auth.data?.status === 200 && bookmarks.isPending),
    isError: bookmarks.isError,
    isToggling: toggle.isPending,
    toggleBookmark,
  };
}
