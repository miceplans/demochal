'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { useToast } from '@/components/common/Toast';
import { Dropdown } from '@/components/ui/Dropdown';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { FileUploader } from '@/components/ui/FileUploader';
import { apiErrorMessage } from '@/lib/api-error';
import { toDateKey } from '@/lib/date';
import { CROPPED_AD_IMAGE_PRESETS, compressToWebP } from '@/lib/image-compression';

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

// 관리자 광고 직접 등록 — 결제 단계 없이 POST /admin/ads가 바로 진행중 광고를 만든다.
// 다이얼로그 모양은 같은 광고 메뉴의 광고비 수정 다이얼로그(AdminAdPricingScreen)를 따른다.
export function AdminAdCreateModal({ onClose, onCreated }: Props) {
  const toast = useToast();
  const titleId = useId();
  const today = toDateKey(new Date());
  const [businessId, setBusinessId] = useState('');
  const [productId, setProductId] = useState('');
  const [title, setTitle] = useState('');
  const [landingUrl, setLandingUrl] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [image, setImage] = useState<{ fileId: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  // 업로드 도중 위치를 바꾸면 이전 위치 규격으로 압축된 결과가 늦게 도착한다. 세대 번호로 버린다.
  const uploadGeneration = useRef(0);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const changeProduct = (value: string) => {
    setProductId(value);
    // 위치마다 이미지 압축 규격이 달라, 위치를 바꾸면 진행 중 업로드를 버리고 다시 올리게 한다.
    uploadGeneration.current += 1;
    setUploading(false);
    setImage(null);
  };

  const handleImage = async (file: File) => {
    if (!product) return;
    const generation = ++uploadGeneration.current;
    setUploading(true);
    setImage(null);
    try {
      const preset =
        product.placement === 'hero'
          ? CROPPED_AD_IMAGE_PRESETS.hero
          : CROPPED_AD_IMAGE_PRESETS.gallery;
      const compressed = await compressToWebP(file, preset);
      URL.revokeObjectURL(compressed.previewUrl);
      const presigned = await requestPresignedUpload.mutateAsync({
        data: {
          bucket: 'public',
          contentType: 'image/webp',
          fileName: compressed.file.name,
          sizeBytes: compressed.file.size,
        },
      });
      // presigned S3 PUT은 API 서버가 아닌 S3로 직접 올리므로 api-client를 거치지 않는다(BizAdsPage와 동일).
      const uploadRes = await fetch(presigned.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': compressed.file.type },
        body: compressed.file,
      });
      if (!uploadRes.ok) throw new Error('이미지 업로드에 실패했어요.');
      await finalizeUpload.mutateAsync({ id: presigned.data.fileId });
      if (generation !== uploadGeneration.current) return;
      setImage({ fileId: presigned.data.fileId, name: file.name });
    } catch (error) {
      if (generation !== uploadGeneration.current) return;
      toast.error('이미지 업로드에 실패했어요', apiErrorMessage(error, '다시 시도해주세요'));
    } finally {
      if (generation === uploadGeneration.current) setUploading(false);
    }
  };

  const canSubmit =
    !!businessId &&
    !!productId &&
    !!title.trim() &&
    !!image &&
    !!startDate &&
    !!endDate &&
    startDate <= endDate &&
    !uploading &&
    !createMutation.isPending;

  const submit = () => {
    if (!canSubmit || !image) return;
    createMutation.mutate({
      data: {
        businessId,
        productId,
        title: title.trim(),
        imageFileId: image.fileId,
        landingUrl: landingUrl.trim() || undefined,
        startDate,
        endDate,
      },
    });
  };

  const uploaderLabel = uploading
    ? '업로드 중…'
    : image
      ? `${image.name} 업로드 완료`
      : product
        ? '광고 이미지를 업로드해 주세요'
        : '위치를 먼저 선택해 주세요';

  if (typeof document === 'undefined') return null;
  return createPortal(
    <Backdrop role="presentation" onMouseDown={onClose}>
      <Dialog
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <DialogTitle id={titleId}>광고 추가</DialogTitle>
        <ModalText>결제 없이 바로 진행중 광고로 등록돼요.</ModalText>

        <Field>
          <FieldLabel>기관</FieldLabel>
          <Dropdown
            aria-label="기관"
            placeholder="기관 선택"
            options={businesses.map((business) => ({
              value: business.id ?? '',
              label: business.org ?? '',
            }))}
            value={businessId}
            onChange={setBusinessId}
          />
        </Field>

        <Field>
          <FieldLabel>위치</FieldLabel>
          <Dropdown
            aria-label="위치"
            placeholder="위치 선택"
            options={products.map((item) => ({ value: item.id, label: item.name }))}
            value={productId}
            onChange={changeProduct}
          />
        </Field>

        <Field as="label">
          <FieldLabel>광고명</FieldLabel>
          <InputBox>
            <Input
              aria-label="광고명"
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="광고명을 입력해 주세요"
            />
          </InputBox>
        </Field>

        <Field as="label">
          <FieldLabel>링크 (선택)</FieldLabel>
          <InputBox>
            <Input
              aria-label="링크"
              type="url"
              value={landingUrl}
              onChange={(event) => setLandingUrl(event.target.value)}
              placeholder="https://"
            />
          </InputBox>
        </Field>

        <Field>
          <FieldLabel>기간</FieldLabel>
          <DateRow>
            <DatePickerField
              aria-label="시작일"
              size="L"
              value={startDate}
              minDate={today}
              onChange={setStartDate}
            />
            <DateDivider>~</DateDivider>
            <DatePickerField
              aria-label="종료일"
              size="L"
              value={endDate}
              minDate={startDate || today}
              invalid={!!startDate && !!endDate && endDate < startDate}
              onChange={setEndDate}
            />
          </DateRow>
        </Field>

        <Field>
          <FieldLabel>이미지</FieldLabel>
          <FileUploader
            aria-label="광고 이미지"
            accept="image/*"
            label={uploaderLabel}
            disabled={!product || uploading}
            onFiles={([file]) => {
              if (file) void handleImage(file);
            }}
          />
        </Field>

        <DialogActions>
          <DialogButton type="button" onClick={onClose}>
            취소
          </DialogButton>
          <DialogButton type="button" primary disabled={!canSubmit} onClick={submit}>
            {createMutation.isPending ? '저장 중…' : '추가'}
          </DialogButton>
        </DialogActions>
      </Dialog>
    </Backdrop>,
    document.body,
  );
}

// 다이얼로그 틀·버튼은 AdminAdPricingScreen의 광고비 수정 다이얼로그와 같은 값이다.
const Backdrop = styled.div({
  position: 'fixed',
  zIndex: 100,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: 'rgba(17, 17, 17, 0.2)',
});
const Dialog = styled.div({
  width: 'min(100%, 606px)',
  padding: 30,
  borderRadius: 9,
  background: c.white,
  display: 'flex',
  flexDirection: 'column',
  gap: 15,
});
const DialogTitle = styled.h2({ margin: 0, ...textStyle.h1_2, color: c.gray900 });
const ModalText = styled.p({ margin: 0, ...textStyle.caption, color: c.gray900 });
const Field = styled.div({ display: 'grid', gap: 8 });
const FieldLabel = styled.span({ ...textStyle.subtitle, color: c.gray900 });
const InputBox = styled.div({
  display: 'flex',
  alignItems: 'center',
  overflow: 'hidden',
  // Dropdown size L·DatePickerField size L과 같은 높이로 맞춘다.
  height: 44,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 8,
  background: c.white,
  '&:focus-within': { borderColor: c.primary, boxShadow: `0 0 0 3px ${c.primary}20` },
});
const Input = styled.input({
  width: '100%',
  minWidth: 0,
  height: '100%',
  padding: '0 14px',
  border: 0,
  outline: 0,
  color: c.gray900,
  background: 'transparent',
  ...textStyle.body,
});
const DateRow = styled.div({ display: 'flex', alignItems: 'center', gap: 8 });
const DateDivider = styled.span({ ...textStyle.body, color: c.gray500 });
const DialogActions = styled.div({ display: 'flex', gap: 15 });
const DialogButton = styled('button', { shouldForwardProp: (prop) => prop !== 'primary' })<{
  primary?: boolean;
}>(({ primary }) => ({
  flex: 1,
  height: 37,
  border: primary ? 0 : `0.5px solid ${c.gray200}`,
  borderRadius: 6,
  background: primary ? c.primary : c.white,
  color: primary ? c.white : c.gray900,
  cursor: 'pointer',
  ...(primary ? textStyle.mFeatureTitle : textStyle.overline),
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
}));
