'use client';

import { useEffect, useRef, useState } from 'react';
import { LoadingState } from '@/apps/user/components/common/LoadingState';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { BizOrgProfile } from '@/apps/biz/components/BizOrgProfile';
import {
  BizContent,
  OutlineButton,
  PrimaryButton,
  useBizHref,
} from '@/apps/biz/components/BizShell';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { useToast } from '@/apps/user/components/common/Toast';
import { AD_IMAGE_PRESETS, compressToWebP, formatBytes } from '@/lib/image-compression';
import { apiErrorMessage } from '@/api/api-error';
import { searchAddress } from '@/lib/google-maps';

type UploadedImage = { fileId: string; previewUrl: string };
type ImageKind = 'banner' | 'logo';

function useExistingImageUrl(fileId?: string | null): string | null {
  const query = generated.useGetFile(fileId ?? '', { query: { enabled: !!fileId } });
  return query.data?.status === 200 ? (query.data.data.url ?? null) : null;
}

export function BizProfileEditPage() {
  const hrefOf = useBizHref();
  const toast = useToast();
  const queryClient = useQueryClient();
  const businessQuery = generated.useFindMyBusiness();
  const business = businessQuery.data?.status === 200 ? businessQuery.data.data : undefined;
  const businessLoadError = businessQuery.isError;

  const [form, setForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [mapCoords, setMapCoords] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({ latitude: null, longitude: null });
  const [initialized, setInitialized] = useState(false);
  const [bannerImage, setBannerImage] = useState<UploadedImage | null>(null);
  const [logoImage, setLogoImage] = useState<UploadedImage | null>(null);
  const [uploading, setUploading] = useState<ImageKind | null>(null);
  const [saveError, setSaveError] = useState(false);
  const previewUrls = useRef(new Set<string>());

  const existingBannerUrl = useExistingImageUrl(business?.bannerImageFileId);
  const existingLogoUrl = useExistingImageUrl(business?.logoImageFileId);
  const existingImages: Record<ImageKind, string | null> = {
    banner: existingBannerUrl,
    logo: existingLogoUrl,
  };

  const requestPresignedUpload = generated.useRequestPresignedUpload();
  const finalizeUpload = generated.useFinalizeUpload();
  const updateBusiness = generated.useUpdateBusiness();

  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  // business는 한 번만 로드되면 되고, 이후 로컬 편집 상태가 진실의 원천이므로
  // refetch로 다시 값이 오더라도 사용자가 입력 중인 form을 덮어쓰지 않는다.
  useEffect(() => {
    if (business && !initialized) {
      // business는 라우트 진입 시 한 번만 조회되는 외부 API 동기화이며,
      // 이후 form은 로컬 편집 상태가 진실의 원천이다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        name: business.name ?? '',
        address: business.address ?? '',
        phone: business.phone ?? '',
        email: business.email ?? '',
      });
      setMapCoords({
        latitude: business.mapLatitude ?? null,
        longitude: business.mapLongitude ?? null,
      });
      setInitialized(true);
    }
  }, [business, initialized]);

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
      const presigned = await requestPresignedUpload.mutateAsync({
        data: {
          bucket: 'public',
          // compressToWebP는 항상 image/webp로 재인코딩한다.
          contentType: 'image/webp',
          fileName: image.file.name,
          sizeBytes: image.file.size,
        },
      });
      const uploadRes = await fetch(presigned.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': image.file.type },
        body: image.file,
      });
      if (!uploadRes.ok) throw new Error('이미지 업로드에 실패했습니다.');
      await finalizeUpload.mutateAsync({ id: presigned.data.fileId });

      const previous = kind === 'banner' ? bannerImage : logoImage;
      if (previous) {
        URL.revokeObjectURL(previous.previewUrl);
        previewUrls.current.delete(previous.previewUrl);
      }
      previewUrls.current.add(image.previewUrl);
      const next = { fileId: presigned.data.fileId, previewUrl: image.previewUrl };
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

  // 구글 지도 API 키가 없는 환경에서도 위치 조정이 가능하도록 브라우저 위치 정보를 쓴다.
  const useCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      toast.error('위치 정보 미지원', '이 브라우저는 현재 위치를 가져올 수 없어요');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setMapCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () =>
        toast.error('위치 조회 실패', '현재 위치를 가져오지 못했어요. 잠시 후 다시 시도해주세요'),
    );
  };

  // 주소 → 좌표 지오코딩은 JS API 키가 필요하다. 키가 있을 때만 검색 UI를 노출한다.
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [addressQuery, setAddressQuery] = useState('');
  const [searchingAddress, setSearchingAddress] = useState(false);
  const searchByAddress = async () => {
    const query = addressQuery.trim();
    if (!query || searchingAddress || !mapsApiKey) return;
    setSearchingAddress(true);
    try {
      const found = await searchAddress(mapsApiKey, query);
      if (found) {
        setMapCoords({ latitude: found.latitude, longitude: found.longitude });
        // 프로필 주소 입력이 비어 있으면 검색한 주소를 자동으로 채운다(이미 있으면 건드리지 않는다).
        setForm((current) =>
          current.address.trim() === '' ? { ...current, address: query } : current,
        );
      } else {
        toast.error('주소 검색 실패', '주소를 찾지 못했어요. 도로명 주소로 다시 시도해주세요');
      }
    } catch {
      toast.error('주소 검색 실패', '지도 서비스를 불러오지 못했어요. 잠시 후 다시 시도해주세요');
    } finally {
      setSearchingAddress(false);
    }
  };

  const save = async () => {
    if (!business) return;
    setSaveError(false);
    try {
      await updateBusiness.mutateAsync({
        id: business.id,
        data: {
          ...form,
          mapLatitude: mapCoords.latitude,
          mapLongitude: mapCoords.longitude,
          ...(bannerImage ? { bannerImageFileId: bannerImage.fileId } : {}),
          ...(logoImage ? { logoImageFileId: logoImage.fileId } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: generated.getFindMyBusinessQueryKey() });
      window.location.href = hrefOf('/profile');
    } catch (error) {
      setSaveError(true);
      toast.error(
        '저장 실패',
        apiErrorMessage(error, '기업 정보를 저장하지 못했어요. 잠시 후 다시 시도해주세요'),
      );
    }
  };

  const fileInput = (kind: ImageKind) => (
    <input
      type="file"
      accept="image/*"
      hidden
      aria-label={kind === 'banner' ? '배너 이미지 선택' : '로고 이미지 선택'}
      disabled={uploading !== null || updateBusiness.isPending}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void uploadImage(kind, file);
      }}
    />
  );

  if (!initialized && businessQuery.isPending)
    return (
      <BizContent>
        <LoadingState label="기업 정보를 불러오는 중입니다." />
      </BizContent>
    );
  if (!business || businessLoadError)
    return (
      <BizContent>
        <p role="alert">
          {apiErrorMessage(businessQuery.error, '기업 정보를 불러오지 못했습니다.')}
        </p>
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
          disabled={updateBusiness.isPending || uploading !== null}
          onClick={() => void save()}
        >
          {updateBusiness.isPending ? '저장 중…' : '저장'}
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
        mapLatitude={mapCoords.latitude}
        mapLongitude={mapCoords.longitude}
        mapAddress={form.address}
        mapEditable
        onMapChange={(latitude, longitude) => setMapCoords({ latitude, longitude })}
      />
      <MapSection>
        <MapSectionTitle>지도 위치</MapSectionTitle>
        <MapControlRow>
          {mapsApiKey ? (
            <>
              <CoordField>
                <span>주소로 찾기</span>
                <SearchInput
                  aria-label="지도 주소 검색"
                  value={addressQuery}
                  placeholder="예: 서울시 강남구 테헤란로 123"
                  disabled={searchingAddress}
                  onChange={(event) => setAddressQuery(event.target.value)}
                  onKeyDown={(event) => {
                    // 한글 IME 조합 중 Enter(음절 확정)로 검색이 트리거되지 않게 한다.
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      void searchByAddress();
                    }
                  }}
                />
              </CoordField>
              <OutlineButton
                type="button"
                disabled={searchingAddress || !addressQuery.trim()}
                onClick={() => void searchByAddress()}
              >
                {searchingAddress ? '검색 중…' : '검색'}
              </OutlineButton>
            </>
          ) : null}
          <OutlineButton type="button" onClick={useCurrentLocation}>
            현재 위치 사용
          </OutlineButton>
        </MapControlRow>
        <MapHint>
          {mapsApiKey
            ? '주소 검색 또는 지도 핀을 드래그해 위치를 지정하세요. 주소 입력이 비어 있으면 검색한 주소가 자동으로 채워져요.'
            : '현재 위치 사용으로 위치를 지정할 수 있어요.'}
        </MapHint>
      </MapSection>
      {saveError && <p role="alert">저장하지 못했습니다.</p>}
    </BizContent>
  );
}

const Actions = styled.div({ display: 'flex', justifyContent: 'flex-end', gap: 8 });
const InlineInput = styled.input({
  width: 360,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 6,
  padding: '4px 6px',
  background: 'transparent',
  font: 'inherit',
  color: 'inherit',
  '&:hover': { background: c.gray50 },
  '&:focus': { outline: 'none', borderColor: c.gray300, background: c.white },
});
const MapSection = styled.section({ display: 'flex', flexDirection: 'column', gap: 10 });
const MapSectionTitle = styled.h2({ margin: 0, ...textStyle.h2, color: c.gray900 });
const MapControlRow = styled.div({ display: 'flex', alignItems: 'flex-end', gap: 12 });
const CoordField = styled.label({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  ...textStyle.caption,
  color: c.gray700,
});
const CoordInput = styled.input({
  width: 160,
  height: 36,
  padding: '0 10px',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 6,
  font: 'inherit',
  '&:focus': { outline: 'none', borderColor: c.gray300 },
});
const SearchInput = styled(CoordInput)({ width: 280 });
const MapHint = styled.p({ margin: 0, ...textStyle.metaText, color: c.gray500 });
