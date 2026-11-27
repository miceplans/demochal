'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DateRange } from 'react-day-picker';
import type { AdPlacement, AdPreviewView } from '@/components/ads/AdPlacementPreview';
import { generated } from '@semochal/api-client';
import { toDateKey } from '@/lib/date';
import { CROPPED_AD_IMAGE_PRESETS, compressToWebP, formatBytes } from '@/lib/image-compression';
import type { CompressedAdImage } from '@/lib/image-compression';
import { useToast } from '@/components/common/Toast';
import {
  adDays,
  adNeedsContent,
  adPaymentAmount,
  adStatusLabel,
  extractErrorMessage,
  firstAvailableAdStart,
  isAdEnded,
} from './BizAdsPage.logic';
import type { Ad, AdsScreen, SelectedAd } from './BizAdsPage.logic';
import { requestBizPayment } from '@/lib/payments';
import { useFileUpload } from '@/lib/upload';
import {
  isBizPaymentEnabled,
  PAYMENTS_DISABLED_DESCRIPTION,
  PAYMENTS_DISABLED_TITLE,
} from '@/lib/payments-gate';
import {
  clearAdPaymentDraft,
  readAdPaymentDraft,
  saveAdPaymentDraft,
  type AdPaymentDraft,
} from '@/lib/ad-payment-draft';

// 광고 관리 화면의 상태·쿼리·액션을 한곳에 모은 컨트롤러 훅.
// 화면(목록/상품/결제/광고명) 컴포넌트는 이 훅이 돌려주는 값만 받아 렌더링한다.
export function useBizAdsController() {
  // 광고 목록은 TanStack Query가 한 번만 불러오고, 실패 시 재시도는 refetch로만 한다.
  // 오류 토스트는 전역 QueryCache onError가 담당한다(401은 제외).
  const queryClient = useQueryClient();
  const contractsQuery = generated.useListMyAds();
  const contracts = contractsQuery.data?.status === 200 ? contractsQuery.data.data : [];
  const contractsLoading = contractsQuery.isPending;
  const contractsError = contractsQuery.isError;
  const updateAdMutation = generated.useUpdateAd();
  const createAdMutation = generated.useCreateAd();
  const updateAdContentMutation = generated.useUpdateAdContent();
  const uploadFile = useFileUpload();
  const cancelOrderMutation = generated.useCancelOrder();
  // 실시간 갱신은 UserShell의 알림 SSE 스트림이 목록 쿼리를 invalidate하므로 폴링하지 않는다.
  const notificationsQuery = generated.useListMyNotifications();
  const priceNotices = (notificationsQuery.data?.data ?? []).filter(
    (item) => item.type === 'ad_price_changed',
  );
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadPlacement, setUploadPlacement] = useState<AdPlacement | null>(null);
  const [uploadedImages, setUploadedImages] = useState<Partial<Record<AdPlacement, string>>>({});
  const [uploadedFileIds, setUploadedFileIds] = useState<Partial<Record<AdPlacement, string>>>({});
  // 결제 완료 후 내용(이미지·광고명) 등록을 기다리는 광고.
  const [contentAd, setContentAd] = useState<Ad | null>(null);
  const [draftContent, setDraftContent] = useState<{
    placement: AdPlacement;
    imageFileId: string;
    title: string;
    landingUrl?: string;
  } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [nameModalPlacement, setNameModalPlacement] = useState<AdPlacement | null>(null);
  const [adName, setAdName] = useState('');
  const [adLink, setAdLink] = useState('');
  const previewUrls = useRef<Set<string>>(new Set());
  const draftGeneration = useRef(0);
  const toast = useToast();

  useEffect(
    () => () => {
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const pauseAd = async (ad: Ad) => {
    if (ad.status !== 'active' || pausingId) return;
    setPausingId(ad.id);
    try {
      await updateAdMutation.mutateAsync({ id: ad.id, data: { status: 'paused' } });
      await queryClient.invalidateQueries({ queryKey: generated.getListMyAdsQueryKey() });
      toast.success('광고를 중단했습니다.');
    } catch {
      // 전역 MutationCache onError 토스트가 실패를 알린다.
    } finally {
      setPausingId(null);
    }
  };
  const deleteAdMutation = generated.useDeleteAd();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteAd = async (ad: Ad) => {
    if (ad.status !== 'preparing' || deletingId) return;
    setDeletingId(ad.id);
    try {
      await deleteAdMutation.mutateAsync({ id: ad.id });
      await queryClient.invalidateQueries({ queryKey: generated.getListMyAdsQueryKey() });
      toast.success('결제 대기 광고를 삭제했습니다.');
    } catch {
      // 전역 MutationCache onError 토스트가 실패를 알린다.
    } finally {
      setDeletingId(null);
    }
  };
  const [view, setView] = useState<AdPreviewView>('pc');
  const [screen, setScreen] = useState<AdsScreen>('manage');
  const [selectedAd, setSelectedAd] = useState<SelectedAd | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStart, setPaymentStart] = useState(() => toDateKey(new Date()));
  const [paymentEnd, setPaymentEnd] = useState(() => toDateKey(new Date()));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>();
  const [calendarViewMonth, setCalendarViewMonth] = useState(() => new Date());
  const datePickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const draft = readAdPaymentDraft();
    if (!draft) return;
    // Defer restoration until after hydration so the server and first browser render match.
    queueMicrotask(() => {
      setDraftContent(draft);
      setUploadedFileIds({ [draft.placement]: draft.imageFileId });
      setAdName(draft.title);
      setAdLink(draft.landingUrl ?? '');
      setNameModalPlacement(draft.placement);
      setScreen('products');
    });
  }, []);
  // 미리보기 툴팁 가격을 서버 상품 가격과 맞춘다. 실패 시 미리보기의 fallback 가격을 쓴다.
  const productsQuery = generated.useListAdProducts();
  const dailyPrices: Partial<Record<AdPlacement, number>> = {};
  for (const product of productsQuery.data?.data ?? []) {
    if (product.placement === 'hero' || product.placement === 'gallery') {
      dailyPrices[product.placement] = product.dailyPrice;
    }
  }
  const openPayment = async (placement: AdPlacement): Promise<boolean> => {
    const generation = draftGeneration.current;
    try {
      // 결제창을 열 때는 캐시된 값 대신 최신 단가/예약 현황을 다시 조회한다.
      const { data: products } = await generated.listAdProducts();
      if (generation !== draftGeneration.current) return false;
      const product = products.find((item) => item.placement === placement);
      if (!product) throw new Error('상품 없음');
      const start = firstAvailableAdStart(product.reservedPeriods, toDateKey(new Date()));
      setSelectedAd({
        placement,
        // 광고명·이미지·링크는 결제 후에 등록한다. 결제 단계에서는 상품명만 쓴다.
        name: product.name,
        price: product.dailyPrice,
        period: start,
        product,
      });
      setPaymentStart(start);
      setPaymentEnd(start);
      // 시작일을 고정점으로 두고 종료일을 새로 클릭할 수 있게 한다. 시작일과 종료일을
      // 같은 값으로 controlled range에 넣으면 react-day-picker가 다음 클릭을 새 시작일로
      // 해석해 기간 확장이 되지 않는다.
      setPendingRange({ from: new Date(`${start}T00:00:00`), to: undefined });
      setDatePickerOpen(false);
      setPaymentOpen(true);
      return true;
    } catch (error) {
      toast.error('광고 상품 정보를 불러오지 못했습니다', extractErrorMessage(error));
      return false;
    }
  };
  const paymentDays = adDays(paymentStart, paymentEnd);
  const paymentAmount = adPaymentAmount(
    paymentStart,
    paymentEnd,
    selectedAd?.product.dailyPrice ?? 0,
  );
  const reserved = selectedAd?.product.reservedPeriods ?? [];
  const overlaps = reserved.some(
    (period) =>
      period.startDate.slice(0, 10) <= paymentEnd && period.endDate.slice(0, 10) >= paymentStart,
  );

  const placementOfAd = (ad: Ad): AdPlacement | null => {
    const placement = (productsQuery.data?.data ?? []).find(
      (product) => product.id === ad.productId,
    )?.placement;
    return placement === 'hero' || placement === 'gallery' ? placement : null;
  };

  const openProducts = () => {
    draftGeneration.current += 1;
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
    setContentAd(null);
    setDraftContent(null);
    clearAdPaymentDraft();
    setUploadPlacement(null);
    setUploadedImages({});
    setUploadedFileIds({});
    setAdName('');
    setAdLink('');
    setNameModalPlacement(null);
    setSelectedAd(null);
    setPaymentOpen(false);
    setDatePickerOpen(false);
    setPendingRange(undefined);
    setScreen('products');
  };

  // 결제 완료 후 이미지·광고명 등록 단계로 들어간다.
  const startContent = (ad: Ad) => {
    const placement = placementOfAd(ad);
    if (!placement) return;
    setContentAd(ad);
    setUploadPlacement(placement);
    setScreen('products');
  };

  const handleSelectPlacement = (placement: AdPlacement) => {
    // 새 광고는 이미지·광고명을 먼저 입력하고, 결제 완료 광고는 기존 콘텐츠 등록 흐름을 따른다.
    if (!contentAd) {
      setUploadPlacement(placement);
      return;
    }
    if (placementOfAd(contentAd) === placement) {
      setUploadPlacement((current) => (current === placement ? null : placement));
    }
  };

  const handleImagePicked = async (placement: AdPlacement, file: File): Promise<void> => {
    if (contentAd && placementOfAd(contentAd) !== placement) {
      toast.error('결제를 완료한 광고만 이미지를 등록할 수 있습니다.');
      return;
    }
    const generation = draftGeneration.current;
    setProcessing(true);
    let image: CompressedAdImage | undefined;
    try {
      image = await compressToWebP(file, CROPPED_AD_IMAGE_PRESETS[placement]);
      // compressToWebP는 항상 image/webp로 재인코딩한다.
      const { fileId } = await uploadFile(image.file, {
        bucket: 'public',
        contentType: 'image/webp',
      });

      if (generation !== draftGeneration.current) {
        URL.revokeObjectURL(image.previewUrl);
        return;
      }

      const previous = uploadedImages[placement];
      if (previous) {
        URL.revokeObjectURL(previous);
        previewUrls.current.delete(previous);
      }
      previewUrls.current.add(image.previewUrl);
      setUploadedImages((current) => ({ ...current, [placement]: image!.previewUrl }));
      setUploadedFileIds((current) => ({ ...current, [placement]: fileId }));
      setUploadPlacement(null);
      toast.success(
        '업로드 되었습니다',
        `성공적으로 업로드 되었습니다. (${formatBytes(image.originalSize)} → ${formatBytes(image.compressedSize)})`,
      );
      setAdName('');
      setAdLink('');
      setNameModalPlacement(placement);
    } catch {
      if (image) URL.revokeObjectURL(image.previewUrl);
      toast.error('업로드 실패', '업로드에 실패했어요. 재시도해주세요');
    } finally {
      setProcessing(false);
    }
  };
  const submitContent = async (placement: AdPlacement) => {
    if (submitting) return;
    const imageFileId = uploadedFileIds[placement];
    if (!imageFileId) {
      toast.error('이미지를 먼저 업로드해 주세요.');
      return;
    }
    const link = adLink.trim();
    // 홈 캐러셀은 http(s)만 랜딩으로 쓴다 — 나머지 스킴은 여기서 막는다.
    if (link && !/^https?:\/\//i.test(link)) {
      toast.error(
        '링크 주소를 확인해주세요',
        'http:// 또는 https://로 시작하는 주소만 등록할 수 있어요',
      );
      return;
    }

    if (!contentAd) {
      const draft: AdPaymentDraft = {
        placement,
        imageFileId,
        title: adName.trim(),
        landingUrl: link || undefined,
      };
      setDraftContent(draft);
      saveAdPaymentDraft(draft);
      const opened = await openPayment(placement);
      if (opened) setNameModalPlacement(null);
      return;
    }

    setSubmitting(true);
    try {
      await updateAdContentMutation.mutateAsync({
        id: contentAd.id,
        data: { imageFileId, title: adName.trim(), landingUrl: link || undefined },
      });
      await queryClient.invalidateQueries({ queryKey: generated.getListMyAdsQueryKey() });
      toast.success('광고가 등록되었습니다.');
      setNameModalPlacement(null);
      setContentAd(null);
      setUploadPlacement(null);
      setUploadedFileIds({});
      setScreen('manage');
    } catch (error) {
      toast.error('광고 등록에 실패했습니다', extractErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };
  const submitReservation = async () => {
    if (!selectedAd || submitting) return;
    if (!isBizPaymentEnabled()) {
      toast.error(PAYMENTS_DISABLED_TITLE, PAYMENTS_DISABLED_DESCRIPTION);
      return;
    }
    if (overlaps) {
      toast.error('이미 계약된 기간이 포함되어 있습니다.');
      return;
    }
    setSubmitting(true);
    try {
      const draft =
        !contentAd && draftContent?.placement === selectedAd.placement ? draftContent : null;
      const created = await createAdMutation.mutateAsync({
        data: {
          productId: selectedAd.product.id,
          startDate: paymentStart,
          endDate: paymentEnd,
          expectedDailyPrice: selectedAd.product.dailyPrice,
          ...(draft
            ? {
                title: draft.title,
                imageFileId: draft.imageFileId,
                ...(draft.landingUrl ? { landingUrl: draft.landingUrl } : {}),
              }
            : {}),
        },
      });
      if (created.status !== 201) throw new Error('예상하지 못한 응답입니다.');
      if (!created.data.order) throw new Error('결제 주문을 생성하지 못했습니다.');
      try {
        // bz 서브도메인에서는 네이버페이, 그 외에는 토스 결제창이 연다(lib/payments 참고).
        const started = await requestBizPayment({
          orderId: created.data.order.id,
          amount: created.data.order.amount,
          orderName: created.data.order.name,
          flow: 'ad',
        });
        if (!started)
          throw new Error('결제창을 열 수 없습니다. 결제 클라이언트 키 설정을 확인해 주세요.');
      } catch (error) {
        // SDK 초기화나 결제창 진입이 실패하면 이 주문이 날짜를 계속 점유하지 않게 한다.
        await cancelOrderMutation.mutateAsync({ id: created.data.order.id }).catch(() => {});
        throw error;
      }
      // 결제창을 연 시점에는 아직 결제가 확정되지 않았다. 완료/실패 안내는 토스가 리다이렉트하는
      // /payments/success(서버 승인) · /payments/fail 페이지가 맡으므로 여기서 화면을 전환하지 않는다.
      await queryClient.invalidateQueries({ queryKey: generated.getListMyAdsQueryKey() });
    } catch (error) {
      toast.error('광고 계약 신청에 실패했습니다', extractErrorMessage(error));
      try {
        const { data: products } = await generated.listAdProducts();
        const product = products.find((item) => item.id === selectedAd.product.id);
        if (product) setSelectedAd({ ...selectedAd, product });
      } catch {
        /* Refreshing product info is best-effort; the toast above already reported the failure. */
      }
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!datePickerOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [datePickerOpen]);

  const toggleDatePicker = () => {
    setDatePickerOpen((open) => {
      const next = !open;
      if (next) {
        setCalendarViewMonth(new Date(`${paymentStart}T00:00:00`));
        setPendingRange({
          from: new Date(`${paymentStart}T00:00:00`),
          to: paymentEnd === paymentStart ? undefined : new Date(`${paymentEnd}T00:00:00`),
        });
      }
      return next;
    });
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setPendingRange(range);
    if (!range?.from) return;
    setPaymentStart(toDateKey(range.from));
    setPaymentEnd(toDateKey(range.to ?? range.from));
    if (range.to) setDatePickerOpen(false);
  };

  const isEnded = (ad: Ad) => isAdEnded(ad, toDateKey(new Date()));
  const needsContent = (ad: Ad) => adNeedsContent(ad, placementOfAd(ad), toDateKey(new Date()));
  const statusLabel = (ad: Ad) => adStatusLabel(ad, needsContent(ad), toDateKey(new Date()));
  const currentAd =
    contracts.find((ad) => ad.status === 'active' && ad.imageUrl) ??
    contracts.find((ad) => ad.imageUrl);

  return {
    // 목록 화면
    contracts,
    contractsLoading,
    contractsError,
    refetchContracts: contractsQuery.refetch,
    priceNotices,
    currentAd,
    pausingId,
    deletingId,
    pauseAd,
    deleteAd,
    isEnded,
    needsContent,
    statusLabel,
    // 화면 전환과 상품 선택
    screen,
    setScreen,
    openProducts,
    startContent,
    view,
    setView,
    dailyPrices,
    uploadPlacement,
    uploadedImages,
    processing,
    handleSelectPlacement,
    handleImagePicked,
    // 결제 팝업
    paymentOpen,
    setPaymentOpen,
    selectedAd,
    paymentDays,
    paymentAmount,
    reserved,
    paymentStart,
    paymentEnd,
    datePickerOpen,
    pendingRange,
    calendarViewMonth,
    setCalendarViewMonth,
    datePickerRef,
    toggleDatePicker,
    handleRangeSelect,
    draftContent,
    submitting,
    submitReservation,
    // 광고명 모달
    nameModalPlacement,
    setNameModalPlacement,
    adName,
    setAdName,
    adLink,
    setAdLink,
    submitContent,
  };
}

export type BizAdsController = ReturnType<typeof useBizAdsController>;
