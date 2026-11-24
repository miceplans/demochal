'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { useToast } from '@/components/common/Toast';
import { apiErrorMessage } from '@/lib/api-error';
import { toDateKey } from '@/lib/date';
import { CROPPED_AD_IMAGE_PRESETS, compressToWebP } from '@/lib/image-compression';

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

// 관리자 광고 직접 등록 — 결제 단계 없이 POST /admin/ads가 바로 진행중 광고를 만든다.
export function AdminAdCreateModal({ onClose, onCreated }: Props) {
  const toast = useToast();
  const today = toDateKey(new Date());
  const [businessId, setBusinessId] = useState('');
  const [productId, setProductId] = useState('');
  const [title, setTitle] = useState('');
  const [landingUrl, setLandingUrl] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [imageFileId, setImageFileId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const businessesQuery = generated.useListAdminBusinesses({ status: 'verified' });
  const productsQuery = generated.useListAdProducts();
  const requestPresignedUpload = generated.useRequestPresignedUpload();
  const finalizeUpload = generated.useFinalizeUpload();

  const businesses = businessesQuery.data?.data.items ?? [];
  const products = productsQuery.data?.data ?? [];
  const product = products.find((item) => item.id === productId);

  const createMutation = generated.useCreateAdminAd({
    mutation: {
      onSuccess: () => {
        toast.success('광고를 추가했어요.');
        onCreated();
      },
      onError: (error) =>
        toast.error('광고 추가에 실패했어요', apiErrorMessage(error, '잠시 후 다시 시도해주세요')),
    },
  });

  const handleImage = async (file: File) => {
    if (!product) {
      toast.error('광고 위치를 먼저 선택해주세요');
      return;
    }
    setUploading(true);
    setImageFileId(null);
    try {
      const preset =
        product.placement === 'hero'
          ? CROPPED_AD_IMAGE_PRESETS.hero
          : CROPPED_AD_IMAGE_PRESETS.gallery;
      const image = await compressToWebP(file, preset);
      URL.revokeObjectURL(image.previewUrl);
      const presigned = await requestPresignedUpload.mutateAsync({
        data: {
          bucket: 'public',
          contentType: 'image/webp',
          fileName: image.file.name,
          sizeBytes: image.file.size,
        },
      });
      // presigned S3 PUT은 API 서버가 아닌 S3로 직접 올리므로 api-client를 거치지 않는다(BizAdsPage와 동일).
      const uploadRes = await fetch(presigned.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': image.file.type },
        body: image.file,
      });
      if (!uploadRes.ok) throw new Error('이미지 업로드에 실패했어요.');
      await finalizeUpload.mutateAsync({ id: presigned.data.fileId });
      setImageFileId(presigned.data.fileId);
    } catch (error) {
      toast.error('이미지 업로드에 실패했어요', apiErrorMessage(error, '다시 시도해주세요'));
    } finally {
      setUploading(false);
    }
  };

  const canSubmit =
    !!businessId &&
    !!productId &&
    !!title.trim() &&
    !!imageFileId &&
    !!startDate &&
    !!endDate &&
    startDate <= endDate &&
    !uploading &&
    !createMutation.isPending;

  const submit = () => {
    if (!canSubmit || !imageFileId) return;
    createMutation.mutate({
      data: {
        businessId,
        productId,
        title: title.trim(),
        imageFileId,
        landingUrl: landingUrl.trim() || undefined,
        startDate,
        endDate,
      },
    });
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <Backdrop role="presentation" onMouseDown={onClose}>
      <Modal
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-ad-create-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <ModalTitle id="admin-ad-create-title">광고 추가</ModalTitle>
        <ModalText>결제 없이 바로 진행중 광고로 등록돼요.</ModalText>

        <Label htmlFor="admin-ad-business">기관</Label>
        <Select
          id="admin-ad-business"
          value={businessId}
          onChange={(event) => setBusinessId(event.target.value)}
        >
          <option value="">기관 선택</option>
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.org}
            </option>
          ))}
        </Select>

        <Label htmlFor="admin-ad-product">위치</Label>
        <Select
          id="admin-ad-product"
          value={productId}
          onChange={(event) => {
            setProductId(event.target.value);
            // 위치마다 이미지 압축 규격이 달라 위치를 바꾸면 다시 올리게 한다.
            setImageFileId(null);
          }}
        >
          <option value="">위치 선택</option>
          {products.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>

        <Label htmlFor="admin-ad-title">광고명</Label>
        <Input
          id="admin-ad-title"
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="광고명을 입력해주세요"
        />

        <Label htmlFor="admin-ad-link">링크 (선택)</Label>
        <Input
          id="admin-ad-link"
          type="url"
          value={landingUrl}
          onChange={(event) => setLandingUrl(event.target.value)}
          placeholder="https://"
        />

        <Label as="span">기간</Label>
        <DateRow>
          <Input
            type="date"
            aria-label="시작일"
            min={today}
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
          <span>~</span>
          <Input
            type="date"
            aria-label="종료일"
            min={startDate || today}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </DateRow>

        <Label htmlFor="admin-ad-image">이미지</Label>
        <Input
          id="admin-ad-image"
          type="file"
          accept="image/*"
          disabled={!product || uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void handleImage(file);
          }}
        />
        <Hint>
          {uploading
            ? '업로드 중…'
            : imageFileId
              ? '업로드 완료'
              : product
                ? '이미지를 선택해주세요'
                : '위치를 먼저 선택해주세요'}
        </Hint>

        <ModalActions>
          <ActionButton type="button" onClick={onClose}>
            취소
          </ActionButton>
          <ActionButton type="button" primary disabled={!canSubmit} onClick={submit}>
            {createMutation.isPending ? '처리 중…' : '추가'}
          </ActionButton>
        </ModalActions>
      </Modal>
    </Backdrop>,
    document.body,
  );
}

const Backdrop = styled.div({
  position: 'fixed',
  zIndex: 100,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: 'rgba(17, 24, 39, .46)',
});
const Modal = styled.div({
  display: 'flex',
  flexDirection: 'column',
  width: 'min(100%, 460px)',
  maxHeight: '100%',
  overflowY: 'auto',
  padding: 28,
  borderRadius: 12,
  background: c.white,
  boxShadow: '0 20px 48px rgba(17, 24, 39, .22)',
});
const ModalTitle = styled.h2({ margin: 0, ...textStyle.h2_2, color: c.gray900 });
const ModalText = styled.p({ margin: '8px 0 0', color: c.gray500, ...textStyle.body });
const Label = styled.label({ marginTop: 16, ...textStyle.metaText, color: c.gray500 });
const fieldStyle = {
  marginTop: 8,
  height: 40,
  padding: '0 12px',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  background: c.white,
  color: c.gray900,
  ...textStyle.bodySmall,
  '&:focus': { outline: 'none', borderColor: c.primary },
} as const;
const Input = styled.input({
  ...fieldStyle,
  minWidth: 0,
  '&[type="file"]': { padding: '8px 0', border: 0 },
});
const Select = styled.select(fieldStyle);
const DateRow = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  '& > input': { flex: 1 },
  '& > span': { marginTop: 8, color: c.gray500 },
});
const Hint = styled.span({ marginTop: 4, ...textStyle.metaText, color: c.gray500 });
const ModalActions = styled.div({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 24,
});
const ActionButton = styled('button', { shouldForwardProp: (prop) => prop !== 'primary' })<{
  primary?: boolean;
}>(({ primary }) => ({
  height: 32,
  padding: '0 12px',
  border: `0.5px solid ${primary ? c.primary : c.gray300}`,
  borderRadius: 6,
  background: primary ? c.primary : c.white,
  color: primary ? c.white : c.gray700,
  cursor: 'pointer',
  ...textStyle.buttonLabel,
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
}));
