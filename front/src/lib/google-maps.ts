import type { GoogleGeocoderResult, GoogleLatLng, GoogleMapsApi } from '@/types/google-maps';

// JS API 스크립트는 페이지에 하나만 주입한다 — 지도 컴포넌트가 여러 번 마운트돼도 재사용한다.
let cached: Promise<GoogleMapsApi> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<GoogleMapsApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('google maps cannot load during ssr'));
  }
  cached ??= new Promise<GoogleMapsApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error('google maps api did not initialise'));
    };
    script.onerror = () => {
      // 재시도 가능하게 캐시를 비운다(키 오기입·네트워크 오류 등).
      cached = null;
      reject(new Error('google maps script failed to load'));
    };
    document.head.appendChild(script);
  });
  return cached;
}

// Geocoder 콜백을 프로미스로 감싼다. 실패(Zero Results 등)는 null을 돌려 호출부가 폰백하게 한다.
export function geocodeAddress(maps: GoogleMapsApi, address: string): Promise<GoogleLatLng | null> {
  return new Promise((resolve) => {
    try {
      new maps.Geocoder().geocode({ address }, (results: GoogleGeocoderResult[] | null, status) => {
        if (status === 'OK' && results?.length) resolve(results[0].geometry.location);
        else resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}
