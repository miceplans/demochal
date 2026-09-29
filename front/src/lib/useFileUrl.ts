'use client';

import { useEffect, useState } from 'react';
import { adApi } from '@/lib/ad-api';

/** 파일 API 실패를 화면 오류로 전파하지 않고, 호출자는 기존 placeholder를 유지한다. */
export function useFileUrl(fileId?: string | null) {
  const [resolved, setResolved] = useState<{ fileId: string; url: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    if (!fileId) return;
    void adApi.files
      .get(fileId)
      .then((file) => {
        if (active) setResolved({ fileId, url: file.url ?? null });
      })
      .catch(() => {
        if (active) setResolved({ fileId, url: null });
      });
    return () => {
      active = false;
    };
  }, [fileId]);

  return resolved && resolved.fileId === fileId ? resolved.url : null;
}
