'use client';

import { useEffect, useRef, useState } from 'react';
import { adApi } from '@/lib/ad-api';
import styled from '@emotion/styled';
import { BizOrgProfile } from '@/components/biz/BizOrgProfile';
import { BizContent, OutlineButton, PrimaryButton, useBizHref } from '@/components/biz/BizShell';
import { colors as c } from '@/styles/design';
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

  const fileInput = (kind: ImageKind) => (
    <input
      type="file"
      accept="image/*"
      hidden
      aria-label={kind === 'banner' ? '배너 이미지 선택' : '로고 이미지 선택'}
      disabled={uploading !== null || state === 'saving'}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void uploadImage(kind, file);
      }}
    />
  );

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
    <BizContent style={{ gap: 32 }}>
      <Actions>
        <OutlineButton type="button" onClick={() => (window.location.href = hrefOf('/profile'))}>
          취소
        </OutlineButton>
        <PrimaryButton
          type="button"
          disabled={state === 'saving' || uploading !== null}
          onClick={() => void save()}
        >
          {state === 'saving' ? '저장 중…' : '저장'}
        </PrimaryButton>
      </Actions>
      {/* TODO: Figma 하단 플로팅 툴바(링크·텍스트·파일·레이아웃·이미지)로 contentBlocks 편집 — 블록 에디터 미구현 */}
      <BizOrgProfile
        bannerUrl={bannerImage?.previewUrl ?? existingImages.banner}
        logoUrl={logoImage?.previewUrl ?? existingImages.logo}
        bannerInput={fileInput('banner')}
        logoInput={fileInput('logo')}
        name={
          <InlineInput
            aria-label="기업명"
            value={form.name}
            onChange={update('name')}
            style={{ fontSize: 24, fontWeight: 600 }}
          />
        }
        address={
          <InlineInput aria-label="주소" value={form.address} onChange={update('address')} />
        }
        phone={<InlineInput aria-label="전화번호" value={form.phone} onChange={update('phone')} />}
        email={
          <InlineInput
            aria-label="이메일"
            type="email"
            value={form.email}
            onChange={update('email')}
          />
        }
      />
      {state === 'error' && <p role="alert">저장하지 못했습니다.</p>}
    </BizContent>
  );
}

const Actions = styled.div({ display: 'flex', justifyContent: 'flex-end', gap: 8 });
const InlineInput = styled.input({
  width: 360,
  border: '1px solid transparent',
  borderRadius: 6,
  padding: '4px 6px',
  background: 'transparent',
  font: 'inherit',
  color: 'inherit',
  '&:hover': { background: c.gray50 },
  '&:focus': { outline: 'none', borderColor: c.gray300, background: c.white },
});
