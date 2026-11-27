'use client';

import { useCallback } from 'react';
import { generated } from '@semochal/api-client';

type PresignedUploadRequest = Parameters<typeof generated.requestPresignedUpload>[0];

/** S3 직접 업로드(PUT) 단계의 실패. API 단계 실패(ApiError)와 구분해 화면 안내를 고를 수 있다. */
export class PresignedUploadError extends Error {
  constructor(public readonly status: number) {
    super(`Presigned upload failed with status ${status}`);
    this.name = 'PresignedUploadError';
  }
}

/**
 * presigned URL로 S3에 파일을 직접 PUT한다.
 *
 * 프론트에서 `fetch`를 직접 부르는 **유일한 허용 예외**다(CLAUDE.md · packages/api-client/README.md).
 * presigned URL은 우리 API가 아니라 S3 주소이고 서명에 Content-Type이 포함되므로
 * api-client(HttpClient: baseUrl·쿠키·JSON 직렬화)를 거칠 수 없다.
 * 새 업로드 코드는 직접 fetch하지 말고 이 함수나 `useFileUpload`를 쓴다.
 */
export async function putToPresignedUrl(
  uploadUrl: string,
  body: Blob,
  contentType: string,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });
  if (!response.ok) throw new PresignedUploadError(response.status);
}

export type UploadOptions = {
  bucket: PresignedUploadRequest['bucket'];
  purpose?: PresignedUploadRequest['purpose'];
  /** 생략하면 file.type을 쓴다. 서버 허용 목록 밖의 타입은 호출부에서 먼저 걸러야 한다. */
  contentType?: PresignedUploadRequest['contentType'];
  /** 생략하면 file.name(경로 구분자는 '_'로 치환)을 쓴다. */
  fileName?: string;
};

export type UploadedFile = {
  fileId: string;
  /** 공개 버킷 파일의 CloudFront URL. 비공개 파일은 null. */
  url: string | null;
};

function safeFileName(name: string): string {
  return name.replace(/[/\\]/g, '_');
}

/**
 * presign → S3 PUT → finalize 세 단계를 한 번에 처리하는 업로드 훅.
 *
 * API 단계는 생성 클라이언트의 mutation을 쓰므로 실패 시 전역 MutationCache 토스트가 뜬다.
 * 화면이 직접 실패를 안내한다면 `localErrors: true`로 전역 토스트를 끈다(이중 토스트 방지).
 */
export function useFileUpload(options?: { localErrors?: boolean }) {
  // mutation 단위 onError가 있으면 전역 MutationCache 토스트를 건너뛴다(MaintenanceGate 참고).
  const mutation = options?.localErrors ? { onError: () => undefined } : undefined;
  const { mutateAsync: requestUpload } = generated.useRequestPresignedUpload({ mutation });
  const { mutateAsync: finalizeUpload } = generated.useFinalizeUpload({ mutation });

  return useCallback(
    async (file: Blob & { name?: string }, upload: UploadOptions): Promise<UploadedFile> => {
      const contentType =
        upload.contentType ?? (file.type as PresignedUploadRequest['contentType']);
      const presigned = await requestUpload({
        data: {
          bucket: upload.bucket,
          ...(upload.purpose ? { purpose: upload.purpose } : {}),
          contentType,
          fileName: safeFileName(upload.fileName ?? file.name ?? 'upload'),
          sizeBytes: file.size,
        },
      });
      const { uploadUrl, fileId } = presigned.data;
      if (!uploadUrl || !fileId) throw new Error('presign response is missing fields');
      await putToPresignedUrl(uploadUrl, file, contentType);
      const finalized = await finalizeUpload({ id: fileId });
      if (finalized.status !== 201) throw new Error('upload verification failed');
      return { fileId, url: finalized.data.url ?? null };
    },
    [requestUpload, finalizeUpload],
  );
}
