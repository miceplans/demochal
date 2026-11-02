'use client';

import { useEffect, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { geocodeAddress, loadGoogleMaps } from '@/lib/google-maps';
import type { GoogleMap, GoogleMarker } from '@/types/google-maps';
import { colors as c } from '@/styles/design';

const ICON = '/assets/icons';

// 주소·좌표가 모두 없을 때 편집 화면의 초기 지도 위치(서울 시청 기준).
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };
const COORDS_ZOOM = 16;
const ADDRESS_ZOOM = 15;

export interface LocationMapProps {
  latitude?: number | null;
  longitude?: number | null;
  /** 좌표가 없을 때 지도 검색에 쓰는 주소 원문(편집 화면의 입력값 등) */
  address?: string | null;
  /** true면 핀 드래그·지도 클릭으로 위치를 바꿀 수 있다 */
  editable?: boolean;
  onChange?: (latitude: number, longitude: number) => void;
}

function normalizeCoords(latitude?: number | null, longitude?: number | null) {
  return typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
    ? { lat: latitude, lng: longitude }
    : null;
}

export function LocationMap(props: LocationMapProps) {
  const { latitude, longitude, address, editable = false, onChange } = props;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const coords = normalizeCoords(latitude, longitude);
  const query = coords ? `${coords.lat},${coords.lng}` : address?.trim() ? address.trim() : null;

  // API 키가 없거나 JS API 로드에 실패하면 키 없이도 동작하는 embed로 폰백한다.
  const [scriptFailed, setScriptFailed] = useState(false);
  if (!apiKey || scriptFailed) {
    if (!query)
      return (
        <Placeholder>
          <img src={`${ICON}/pin.svg`} alt="" width={24} height={24} />
          <span>위치가 아직 없어요</span>
        </Placeholder>
      );
    return (
      <Embed
        title="기업 위치 지도"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={`https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${coords ? COORDS_ZOOM : ADDRESS_ZOOM}&output=embed`}
      />
    );
  }
  return (
    <GoogleMapView
      latitude={latitude}
      longitude={longitude}
      address={address}
      editable={editable}
      onChange={onChange}
      onScriptError={() => setScriptFailed(true)}
    />
  );
}

function GoogleMapView({
  latitude,
  longitude,
  address,
  editable,
  onChange,
  onScriptError,
}: LocationMapProps & { onScriptError: () => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);
  // 리스너 등록 시점의 onChange 클로저가 stale해지지 않게 ref로 둔다.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const element = containerRef.current;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!element || !apiKey) return;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(async (maps) => {
        if (cancelled) return;
        const coords = normalizeCoords(latitude, longitude);
        let center = coords ?? DEFAULT_CENTER;
        const zoom = coords ? COORDS_ZOOM : ADDRESS_ZOOM;
        if (!coords && address?.trim()) {
          // 저장된 핀이 없으면 주소를 지오코딩해 초기 화면을 잡는다(핀은 찍지 않는다).
          const geocoded = await geocodeAddress(maps, address.trim());
          if (cancelled) return;
          if (geocoded) center = { lat: geocoded.lat(), lng: geocoded.lng() };
        }
        const map = new maps.Map(element, {
          center,
          zoom,
          scrollwheel: !editable,
          disableDefaultUI: false,
        });
        mapRef.current = map;
        const marker = new maps.Marker({
          position: coords,
          map,
          draggable: editable,
          visible: Boolean(coords),
        });
        markerRef.current = marker;
        if (editable) {
          map.addListener('click', (event) => {
            const point = event.latLng;
            if (!point) return;
            marker.setPosition({ lat: point.lat(), lng: point.lng() });
            marker.setVisible(true);
            onChangeRef.current?.(point.lat(), point.lng());
          });
          marker.addListener('dragend', () => {
            const point = marker.getPosition();
            if (!point) return;
            onChangeRef.current?.(point.lat(), point.lng());
          });
        }
      })
      .catch(() => {
        if (!cancelled) onScriptError();
      });

    return () => {
      cancelled = true;
    };
    // 지도 인스턴스는 마운트 시 한 번만 만든다 — 이후 좌표 변경은 아래 effect가 반영한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 좌표 prop 변경을 지도/핀에 반영한다(부모 상태와 양방향 동기화).
  useEffect(() => {
    const coords = normalizeCoords(latitude, longitude);
    if (coords && mapRef.current) {
      mapRef.current.setCenter(coords);
      markerRef.current?.setPosition(coords);
      markerRef.current?.setVisible(true);
    }
    if (!coords) {
      markerRef.current?.setPosition(null);
      markerRef.current?.setVisible(false);
    }
  }, [latitude, longitude]);

  return <MapContainer ref={containerRef} />;
}

const MapContainer = styled.div({ width: '100%', height: '100%', minHeight: 184 });
const Embed = styled.iframe({ width: '100%', height: '100%', border: 0, borderRadius: 8 });
const Placeholder = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  width: '100%',
  height: '100%',
  minHeight: 184,
  borderRadius: 8,
  background: c.gray100,
  color: c.gray500,
  fontSize: 13,
});
