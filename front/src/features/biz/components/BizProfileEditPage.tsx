'use client';

import { useEffect, useRef, useState } from 'react';
import { adApi } from '@/lib/ad-api';
import {
  BizContent,
  SectionTitle,
  FieldInput,
  PrimaryButton,
  useBizHref,
} from '@/components/biz/BizShell';
import { useToast } from '@/components/common/Toast';
import { AD_IMAGE_PRESETS, compressToWebP, formatBytes } from '@/lib/image-compression';

type UploadedImage = { fileId: string; previewUrl: string };
type ImageKind = 'banner' | 'logo';

async function resolveFileUrl(fileId?: string | null): Promise<string | null> {
  if (!fileId) return null;
  try {
    const file = await adApi.files.get(fileId);
    return file.url ?? null;
  } catch {
    return null;
  }
}

export function BizProfileEditPage() {
  const hrefOf = useBizHref();
  const toast = useToast();
  const [id, setId] = useState('');
  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [existingImages, setExistingImages] = useState<Record<ImageKind, string | null>>({
    banner: null,
    logo: null,
  });
  const [bannerImage, setBannerImage] = useState<UploadedImage | null>(null);
  const [logoImage, setLogoImage] = useState<UploadedImage | null>(null);
  const [uploading, setUploading] = useState<ImageKind | null>(null);
  const previewUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => {
    void adApi.businesses
      .me()
      .then(async (business) => {
        setId(business.id);
        setForm({
          name: business.name,
          address: business.address ?? '',
          phone: business.phone ?? '',
          email: business.email ?? '',
        });
        const [banner, logo] = await Promise.all([
          resolveFileUrl(business.bannerImageFileId),
          resolveFileUrl(business.logoImageFileId),
        ]);
        setExistingImages({ banner, logo });
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);
  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  // 로컬 object URL은 미리보기에만 쓰고, 서버에는 presign/finalize로 받은 파일 id만 별도 상태로 전송한다.
  const uploadImage = async (kind: ImageKind, file: File) => {
    if (uploading) return;
    setUploading(kind);
    let image: Awaited<ReturnType<typeof compressToWebP>> | undefined;
    try {
      image = await compressToWebP(
        file,
        kind === 'banner' ? AD_IMAGE_PRESETS.hero : AD_IMAGE_PRESETS.gallery,
      );
      const presigned = await adApi.files.requestUpload({
        bucket: 'public',
        contentType: image.file.type,
        fileName: image.file.name,
        sizeBytes: image.file.size,
      });
      const uploadRes = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': image.file.type },
        body: image.file,
      });
      if (!uploadRes.ok) throw new Error('이미지 업로드에 실패했습니다.');
      await adApi.files.finalizeUpload(presigned.fileId);

      const previous = kind === 'banner' ? bannerImage : logoImage;
      if (previous) {
        URL.revokeObjectURL(previous.previewUrl);
        previewUrls.current.delete(previous.previewUrl);
      }
      previewUrls.current.add(image.previewUrl);
      const next = { fileId: presigned.fileId, previewUrl: image.previewUrl };
      if (kind === 'banner') setBannerImage(next);
      else setLogoImage(next);
      toast.success(
        '업로드 되었습니다',
        `성공적으로 업로드 되었습니다. (${formatBytes(image.originalSize)} → ${formatBytes(image.compressedSize)})`,
      );
    } catch {
      if (image) URL.revokeObjectURL(image.previewUrl);
      toast.error('업로드 실패', '이미지 업로드에 실패했어요. 재시도해주세요');
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    setState('saving');
    try {
      await adApi.businesses.update(id, {
        ...form,
        ...(bannerImage ? { bannerImageFileId: bannerImage.fileId } : {}),
        ...(logoImage ? { logoImageFileId: logoImage.fileId } : {}),
      });
      window.location.href = hrefOf('/profile');
    } catch {
      setState('error');
      toast.error('저장 실패', '기업 정보를 저장하지 못했어요. 잠시 후 다시 시도해주세요');
    }
  };

  const renderImageField = (kind: ImageKind, label: string) => {
    const uploaded = kind === 'banner' ? bannerImage : logoImage;
    const previewUrl = uploaded?.previewUrl ?? existingImages[kind];
    return (
      <label style={{ display: 'grid', gap: 8 }}>
        {label}
        <input
          type="file"
          accept="image/*"
          disabled={uploading !== null || state === 'saving'}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void uploadImage(kind, file);
          }}
        />
        {uploading === kind ? (
          <span style={{ fontSize: 13 }}>이미지를 업로드하는 중입니다…</span>
        ) : previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={`${label} 미리보기`}
            style={{ maxWidth: kind === 'banner' ? 320 : 120, borderRadius: 8, objectFit: 'cover' }}
          />
        ) : (
          <span style={{ fontSize: 13 }}>등록된 이미지가 없습니다.</span>
        )}
      </label>
    );
  };

  if (state === 'loading')
    return (
      <BizContent>
        <p>기업 정보를 불러오는 중입니다.</p>
      </BizContent>
    );
  if (!id)
    return (
      <BizContent>
        <p>기업 정보를 불러오지 못했습니다.</p>
      </BizContent>
    );
  return (
    <BizContent>
      <SectionTitle>기업 프로필 수정</SectionTitle>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        style={{ display: 'grid', gap: 16, maxWidth: 520 }}
      >
        <label>
          기업명
          <FieldInput value={form.name} onChange={update('name')} required />
        </label>
        <label>
          주소
          <FieldInput value={form.address} onChange={update('address')} />
        </label>
        <label>
          전화번호
          <FieldInput value={form.phone} onChange={update('phone')} />
        </label>
        <label>
          이메일
          <FieldInput type="email" value={form.email} onChange={update('email')} />
        </label>
        {renderImageField('banner', '배너 이미지')}
        {renderImageField('logo', '로고 이미지')}
        {state === 'error' && <p>저장하지 못했습니다.</p>}
        <PrimaryButton type="submit" disabled={state === 'saving' || uploading !== null}>
          {state === 'saving' ? '저장 중…' : '저장'}
        </PrimaryButton>
      </form>
    </BizContent>
  );
}
